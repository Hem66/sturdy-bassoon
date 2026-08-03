#!/usr/bin/env python3
"""
Retrieve ECDSA private key by exploiting a nonce-reuse in signatures.

Needed package : ecdsa

    pip3 install ecdsa

"""

import argparse
import base64
import binascii
import hashlib
import sys

from ecdsa import SECP256k1, SigningKey, VerifyingKey
from ecdsa.util import sigdecode_der


HASH_ALGS = {
    "sha1": hashlib.sha1,
    "sha224": hashlib.sha224,
    "sha256": hashlib.sha256,
    "sha384": hashlib.sha384,
    "sha512": hashlib.sha512,
    "md5": hashlib.md5,
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Retrieve ECDSA private key by exploiting a nonce-reuse in signatures."
    )

    parser.add_argument("-q", "--quiet", action="store_true", help="Do not output anything on terminal (but errors and exceptions may still be printed). Private key will be printed in default file.")
    parser.add_argument("-v", "--verbosity", action="count", default=0, help="Increase output verbosity")

    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("-files", dest="files", action="store_true", help="Specify this command if you want to read input from files.")
    mode.add_argument("-cli", dest="cli", action="store_true", help="Specify this command if you want to read values directly from cli.")
    mode.add_argument("-hardcoded", dest="hardcoded", action="store_true", help="Modify values inside this script to operate.")
    mode.add_argument("-hardcoded-files", dest="hardcoded_files", action="store_true", help="Modify file names inside this script to operate.")

    parser.add_argument("--pubkey", dest="pubkey_file", help="Path to the file containing a PEM encoded public key.")
    parser.add_argument("--message1", dest="message1_file", help="Path to the text file containing the first message that has been signed.")
    parser.add_argument("--message2", dest="message2_file", help="Path to the text file containing the second message that has been signed.")
    parser.add_argument("--signature1", dest="signature1_file", help="Path to the text file containing the base64 encoded signature of the first message.")
    parser.add_argument("--signature2", dest="signature2_file", help="Path to the text file containing the base64 encoded signature of the second message.")
    parser.add_argument("--hashalg", choices=HASH_ALGS.keys(), default="sha256", help="Hash algorithm used for the signatures.")
    parser.add_argument("--output", dest="output", default="private_key_recovered.txt", help="Output file to print the private key to.")

    parser.add_argument("-pk", dest="pubkey_cli", help="PEM encoded public key.")
    parser.add_argument("-m1", dest="message1_cli", help="First message that has been signed.")
    parser.add_argument("-m2", dest="message2_cli", help="Second message that has been signed.")
    parser.add_argument("-sig1", dest="signature1_cli", help="Base64 encoded signature of the first message.")
    parser.add_argument("-sig2", dest="signature2_cli", help="Base64 encoded signature of the second message.")
    parser.add_argument("-alg", dest="hashalg_cli", choices=HASH_ALGS.keys(), help="Hash algorithm used for the signatures.")
    parser.add_argument("-o", dest="output_cli", help="Output file to print the private key to.")
    parser.add_argument("-r", dest="r_cli", help="First half of the signature that is common in both signatures.")
    parser.add_argument("-s1", dest="s1_cli", help="Second half of the signature of first message.")
    parser.add_argument("-s2", dest="s2_cli", help="Second half of the signature of second message.")

    return parser.parse_args()


def strip_text(data: str) -> str:
    return data.strip().replace("\r", "").replace("\n", "")


def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def parse_pubkey(pem_data: str) -> VerifyingKey:
    pem_data = strip_text(pem_data)
    if pem_data.startswith("-----BEGIN PUBLIC KEY-----") or pem_data.startswith("-----BEGIN EC PUBLIC KEY-----"):
        return VerifyingKey.from_pem(pem_data)
    raise ValueError("Unsupported public key format. Expected PEM encoded public key.")


def parse_signature(sig_text: str):
    sig_text = strip_text(sig_text)

    try:
        raw = base64.b64decode(sig_text)
    except (binascii.Error, ValueError):
        raise ValueError("Signature appears not to be base64 encoded.")

    # Try DER decode first, which is common for ECDSA signatures
    try:
        r, s = sigdecode_der(raw, SECP256k1.order)
        return r, s
    except Exception:
        pass

    if len(raw) == 64:
        r = int.from_bytes(raw[:32], "big")
        s = int.from_bytes(raw[32:], "big")
        return r, s

    raise ValueError("Unsupported signature format. Expected base64 DER or raw 64-byte concatenation.")


def parse_int(value: str) -> int:
    value = strip_text(value)
    if value.startswith("0x") or value.startswith("0X"):
        return int(value, 16)
    return int(value)


def hash_message(message: bytes, hashalg: str) -> int:
    digest = HASH_ALGS[hashalg](message).digest()
    return int.from_bytes(digest, "big")


def recover_private_key(r: int, s1: int, s2: int, z1: int, z2: int, curve=SECP256k1) -> int:
    n = curve.order
    if s1 == s2:
        raise ValueError("s1 and s2 are equal; cannot recover nonce from identical signatures.")

    k = ((z1 - z2) * pow(s1 - s2, -1, n)) % n
    d = ((s1 * k - z1) * pow(r, -1, n)) % n
    return d


def verify_private_key(private_key_int: int, pubkey: VerifyingKey) -> bool:
    sk = SigningKey.from_secret_exponent(private_key_int, curve=SECP256k1)
    derived_vk = sk.get_verifying_key()
    return derived_vk.to_string() == pubkey.to_string()


def format_private_key(private_key_int: int) -> str:
    return format(private_key_int, "064x")


def output_result(output_path: str, private_key_hex: str, quiet: bool):
    with open(output_path, "w", encoding="utf-8") as out:
        out.write(private_key_hex + "\n")

    if not quiet:
        print(f"Recovered private key written to: {output_path}")
        print(f"Private key (hex): {private_key_hex}")


def main():
    args = parse_args()

    pubkey = None
    hashalg = "sha256"
    output_path = args.output
    r = None
    s1 = None
    s2 = None
    z1 = None
    z2 = None

    if args.cli:
        if args.hashalg_cli:
            hashalg = args.hashalg_cli
        if args.output_cli:
            output_path = args.output_cli

        if args.pubkey_cli:
            pubkey = parse_pubkey(args.pubkey_cli)

        if args.r_cli and args.s1_cli and args.s2_cli:
            r = parse_int(args.r_cli)
            s1 = parse_int(args.s1_cli)
            s2 = parse_int(args.s2_cli)

        if args.signature1_cli and args.signature2_cli:
            r1, s1sig = parse_signature(args.signature1_cli)
            r2, s2sig = parse_signature(args.signature2_cli)
            if r is None:
                if r1 != r2:
                    raise ValueError("Signature r values are not equal. Nonce reuse requires the same r value.")
                r = r1
            s1 = s1 or s1sig
            s2 = s2 or s2sig

        if args.message1_cli is None or args.message2_cli is None:
            raise ValueError("Both messages must be provided in CLI mode.")

        z1 = hash_message(args.message1_cli.encode("utf-8"), hashalg)
        z2 = hash_message(args.message2_cli.encode("utf-8"), hashalg)

    elif args.files:
        hashalg = args.hashalg
        output_path = args.output

        if args.pubkey_file:
            pubkey = parse_pubkey(read_file(args.pubkey_file))
        if args.message1_file is None or args.message2_file is None:
            raise ValueError("Both message files must be provided in files mode.")
        if args.signature1_file is None or args.signature2_file is None:
            raise ValueError("Both signature files must be provided in files mode.")

        message1 = read_file(args.message1_file).encode("utf-8")
        message2 = read_file(args.message2_file).encode("utf-8")
        z1 = hash_message(message1, hashalg)
        z2 = hash_message(message2, hashalg)

        r1, s1 = parse_signature(read_file(args.signature1_file))
        r2, s2 = parse_signature(read_file(args.signature2_file))
        if r1 != r2:
            raise ValueError("Signature r values are not equal. Nonce reuse requires the same r value.")
        r = r1

    elif args.hardcoded or args.hardcoded_files:
        raise NotImplementedError("Hardcoded mode is not implemented. Please modify the script directly.")

    else:
        raise ValueError("No mode selected.")

    if r is None or s1 is None or s2 is None or z1 is None or z2 is None:
        raise ValueError("Missing values required to recover the private key.")

    private_key_int = recover_private_key(r, s1, s2, z1, z2)
    private_key_hex = format_private_key(private_key_int)

    if pubkey is not None:
        if verify_private_key(private_key_int, pubkey):
            if not args.quiet:
                print("Public key verification succeeded.")
        else:
            raise ValueError("Recovered private key does not match provided public key.")

    output_result(output_path, private_key_hex, args.quiet)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
