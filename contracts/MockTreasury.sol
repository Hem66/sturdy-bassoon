// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockTreasury {
    enum Outlet { NONE, X7DEV1 }

    Outlet public currentOutlet;
    address public recipient;
    mapping(address => Outlet) public outletLookup;
    uint256 public pendingBalance;

    event RecipientChanged(address oldRecipient, address newRecipient);

    address public constant INITIAL_RECIPIENT = 0x7c982346e5bF9A5272cf9cF4A1Dd391478f0E694;

    constructor() {
        recipient = INITIAL_RECIPIENT;
        outletLookup[INITIAL_RECIPIENT] = Outlet.X7DEV1;
        currentOutlet = Outlet.X7DEV1;
    }

    receive() external payable {
        pendingBalance += msg.value;
    }

    function setRecipient(address newRecipient) external {
        address oldRecipient = recipient;
        recipient = newRecipient;
        outletLookup[newRecipient] = Outlet.X7DEV1;
        emit RecipientChanged(oldRecipient, newRecipient);
    }

    function takeBalance() external {
        require(outletLookup[msg.sender] == Outlet.X7DEV1 || msg.sender == recipient, "not recipient");
        uint256 amount = pendingBalance;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "send failed");
        pendingBalance = 0;
    }

    function payoutToRecipient() external {
        address payable to = payable(recipient);
        uint256 amount = pendingBalance;
        (bool success, ) = to.call{value: amount}("");
        require(success, "send failed");
        pendingBalance = 0;
    }

    function pushAll() external {
        address payable to = payable(recipient);
        uint256 amount = address(this).balance;
        (bool success, ) = to.call{value: amount}("");
        require(success, "send failed");
    }
}

contract ReentrantRecipient {
    MockTreasury public treasury;
    bool public hasReentered;

    constructor(address payable treasuryAddress) {
        treasury = MockTreasury(treasuryAddress);
    }

    function attack() external {
        treasury.takeBalance();
    }

    receive() external payable {
        if (!hasReentered) {
            hasReentered = true;
            treasury.takeBalance();
        }
    }
}

contract SelfdestructSender {
    constructor() payable {}

    function sendAll(address payable target) external {
        selfdestruct(target);
    }
}
