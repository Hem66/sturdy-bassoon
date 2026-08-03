#!/usr/bin/env python3
"""Optimism transaction scanner for EOA signature reuse detection.

This script uses a plain JSON-RPC provider and does not rely on Etherscan/Cf challenge pages.
It scans a block range, finds transactions sent from a target address, and reports duplicate ECDSA r values.
"""

import argparse
import json
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError


def parse_args():
    parser = argparse.ArgumentParser(
        description="Scan Optimism blocks for transactions sent from an address and detect duplicate signature r values."
    )
    parser.add_argument("--address", required=True, help="Address to scan (EOA or contract).")
    parser.add_argument(
        "--provider",
        default="https://mainnet.optimism.io",
        help="Primary JSON-RPC provider URL. Deprecated when --providers is used.",
    )
    parser.add_argument(
        "--providers",
        help="Comma-separated JSON-RPC provider URLs to try in order. Overrides --provider.",
    )
    parser.add_argument("--start-block", type=int, default=0, help="Block number to start scanning from.")
    parser.add_argument("--end-block", type=int, default=-1, help="Block number to stop scanning at. Use -1 for latest.")
    parser.add_argument("--batch-size", type=int, default=10, help="Number of blocks to fetch per JSON-RPC batch request.")
    parser.add_argument(
        "--direction",
        choices=["all", "outgoing", "incoming"],
        default="outgoing",
        help="Filter transactions by direction relative to the target address.",
    )
    parser.add_argument("--json-output", help="Write results to a JSON file.")
    parser.add_argument("--csv-output", help="Write matched transactions to a CSV file.")
    parser.add_argument("--timeout", type=float, default=30.0, help="Provider request timeout in seconds.")
    parser.add_argument("--quiet", action="store_true", help="Only print results, not progress logs.")
    return parser.parse_args()


def normalize_address(address: str) -> str:
    if address.startswith("0x"):
        return address.lower()
    return "0x" + address.lower()


def rpc_request(url: str, payload, timeout: float):
    data = json.dumps(payload).encode("utf-8")
    req = Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except HTTPError as exc:
        raise RuntimeError(f"RPC HTTP error {exc.code}: {exc.reason}") from exc
    except URLError as exc:
        raise RuntimeError(f"RPC connection error: {exc}") from exc


def rpc_batch_request(url: str, requests_payload, timeout: float):
    if not requests_payload:
        return []

    response = rpc_request(url, requests_payload, timeout)
    if isinstance(response, list):
        return response

    # Some providers may return a single object or error response for a batch request.
    # Fall back to sequential requests in that case.
    if isinstance(response, dict):
        results = []
        for req in requests_payload:
            results.append(rpc_request(url, req, timeout))
        return results

    raise RuntimeError("Expected batch RPC response to be a JSON list.")


def get_latest_block(provider: str, timeout: float) -> int:
    payload = {"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []}
    response = rpc_request(provider, payload, timeout)
    if "result" not in response:
        raise RuntimeError(f"No block number returned from provider: {response}")
    return int(response["result"], 16)


def get_blocks(provider: str, block_numbers, timeout: float):
    payload = []
    for idx, block_number in enumerate(block_numbers, start=1):
        payload.append(
            {
                "jsonrpc": "2.0",
                "id": idx,
                "method": "eth_getBlockByNumber",
                "params": [hex(block_number), True],
            }
        )
    response = rpc_batch_request(provider, payload, timeout)
    response_by_id = {item["id"]: item for item in response}
    blocks = []
    for item in payload:
        result = response_by_id.get(item["id"], {}).get("result")
        blocks.append(result)
    return blocks


def matches_direction(tx: dict, address_norm: str, direction: str) -> bool:
    tx_from = tx.get("from", "").lower()
    tx_to = tx.get("to", "").lower() if tx.get("to") else ""
    if direction == "all":
        return tx_from == address_norm or tx_to == address_norm
    if direction == "outgoing":
        return tx_from == address_norm
    if direction == "incoming":
        return tx_to == address_norm
    return False


def scan_transactions(provider: str, address: str, start_block: int, end_block: int, batch_size: int, timeout: float, quiet: bool, direction: str = "outgoing"):
    address_norm = normalize_address(address)
    latest_block = end_block
    if end_block < 0:
        if not quiet:
            print("Resolving latest block number...")
        latest_block = get_latest_block(provider, timeout)
    if start_block < 0 or start_block > latest_block:
        raise ValueError("Invalid start block for scan range.")
    if end_block < 0:
        end_block = latest_block
    if not quiet:
        print(f"Scanning blocks {start_block}..{end_block} using provider {provider}")

    matched_txs = []
    total_blocks = end_block - start_block + 1
    for chunk_start in range(start_block, end_block + 1, batch_size):
        chunk_end = min(end_block, chunk_start + batch_size - 1)
        block_numbers = list(range(chunk_start, chunk_end + 1))
        if not quiet:
            print(f"Fetching blocks {chunk_start}..{chunk_end}...")
        blocks = get_blocks(provider, block_numbers, timeout)
        for block in blocks:
            if block is None:
                continue
            for tx in block.get("transactions", []):
                if matches_direction(tx, address_norm, direction):
                    matched_txs.append(
                        {
                            "hash": tx.get("hash"),
                            "blockNumber": int(tx.get("blockNumber", "0x0"), 16) if tx.get("blockNumber") else None,
                            "nonce": int(tx.get("nonce", "0x0"), 16) if tx.get("nonce") else None,
                            "from": tx.get("from"),
                            "to": tx.get("to"),
                            "value": tx.get("value"),
                            "r": tx.get("r"),
                            "s": tx.get("s"),
                            "v": tx.get("v"),
                        }
                    )
        if not quiet:
            progress = min(chunk_end, end_block) - start_block + 1
            print(f"Scanned {progress}/{total_blocks} blocks, found {len(matched_txs)} matched tx(s)")
        time.sleep(0.1)

    return matched_txs


def try_provider(provider: str, func, *args, timeout: float, quiet: bool, **kwargs):
    try:
        if not quiet:
            print(f"Trying provider: {provider}")
        return func(provider, *args, timeout=timeout, quiet=quiet, **kwargs)
    except Exception as exc:
        if not quiet:
            print(f"Provider failed: {provider} -> {exc}")
        raise


def find_duplicate_r(transactions):
    duplicates = {}
    r_map = {}
    for tx in transactions:
        r = tx.get("r")
        if not r:
            continue
        r_map.setdefault(r, []).append(tx)
    for r, txs in r_map.items():
        if len(txs) > 1:
            duplicates[r] = txs
    return duplicates


def main():
    args = parse_args()
    providers = []
    if args.providers:
        providers = [p.strip() for p in args.providers.split(",") if p.strip()]
    if not providers:
        providers = [args.provider]

    last_error = None
    txs = None
    used_provider = None
    for provider in providers:
        try:
            txs = try_provider(
                provider,
                scan_transactions,
                args.address,
                args.start_block,
                args.end_block,
                args.batch_size,
                timeout=args.timeout,
                quiet=args.quiet,
            )
            used_provider = provider
            break
        except Exception as exc:
            last_error = exc
            continue

    if txs is None:
        print(f"All providers failed. Last error: {last_error}", file=sys.stderr)
        sys.exit(1)

    duplicates = find_duplicate_r(txs)
    result = {
        "address": normalize_address(args.address),
        "provider": used_provider,
        "start_block": args.start_block,
        "end_block": args.end_block,
        "direction": args.direction,
        "scanned_transactions": len(txs),
        "duplicate_r_values": {r: len(txs) for r, txs in duplicates.items()},
        "duplicate_details": duplicates,
    }

    if args.json_output:
        with open(args.json_output, "w", encoding="utf-8") as fd:
            json.dump(result, fd, indent=2)
        if not args.quiet:
            print(f"Results written to {args.json_output}")

    if args.csv_output:
        import csv

        with open(args.csv_output, "w", encoding="utf-8", newline="") as fd:
            writer = csv.DictWriter(
                fd,
                fieldnames=["hash", "blockNumber", "nonce", "from", "to", "value", "r", "s", "v"],
            )
            writer.writeheader()
            for tx in txs:
                writer.writerow(tx)
        if not args.quiet:
            print(f"CSV results written to {args.csv_output}")

    print("\nSummary")
    print(f"Address: {result['address']}")
    print(f"Provider: {result['provider']}")
    print(f"Direction: {result['direction']}")
    print(f"Transactions matched: {len(txs)}")
    if duplicates:
        print(f"Duplicate r values found: {len(duplicates)}")
        for r, txs in duplicates.items():
            print(f"\nDuplicate r = {r} appears in {len(txs)} tx(s):")
            for tx in txs:
                print(f"  block {tx['blockNumber']} hash {tx['hash']} nonce {tx['nonce']} s={tx['s']} v={tx['v']}")
    else:
        print("No duplicate r values found in the scanned range.")

    if args.json_output and not args.quiet:
        print(f"Saved JSON output to {args.json_output}")


if __name__ == "__main__":
    main()
