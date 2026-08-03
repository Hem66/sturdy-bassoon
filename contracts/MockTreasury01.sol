// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockTreasury01 {
    address payable public owner;

    constructor(address payable _owner) payable {
        owner = _owner;
    }

    receive() external payable {
        // Forward immediately to owner
        if (address(this).balance > 0) {
            (bool success, ) = owner.call{value: address(this).balance}("");
            require(success, "forward failed");
        }
    }

    // helper to check balance
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
