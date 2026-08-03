const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ForceSend (selfdestruct) -> MockTreasury", function () {
  it("forces ETH into MockTreasury without updating pendingBalance", async function () {
    const [deployer] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockTreasury");
    const mock = await Mock.deploy();
    await mock.deployed();

    const ether = ethers.utils.parseEther;

    // Send 0.3 ETH via normal transfer -> should update pendingBalance
    await deployer.sendTransaction({ to: mock.address, value: ether("0.3") });
    const pending1 = await mock.pendingBalance();
    expect(pending1.toString()).to.equal(ether("0.3").toString());

    // Deploy SelfdestructSender with 1 ETH
    const Sender = await ethers.getContractFactory("SelfdestructSender");
    const sender = await Sender.deploy({ value: ether("1") });
    await sender.deployed();

    // Trigger selfdestruct -> funds forced to MockTreasury (does NOT run its code)
    await (await sender.sendAll(mock.address)).wait();

    const bal = await ethers.provider.getBalance(mock.address);
    const pending2 = await mock.pendingBalance();

    // Balance should reflect both the normal send and the forced-send
    expect(bal.toString()).to.equal(ether("1.3").toString());
    // pendingBalance remains only what was deposited via receive()
    expect(pending2.toString()).to.equal(ether("0.3").toString());
  });

  it("forces 1 wei into MockTreasury without updating pendingBalance", async function () {
    const [deployer] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockTreasury");
    const mock = await Mock.deploy();
    await mock.deployed();

    const ether = ethers.utils.parseEther;

    // Send 0.3 ETH via normal transfer -> should update pendingBalance
    await deployer.sendTransaction({ to: mock.address, value: ether("0.3") });
    const pending1 = await mock.pendingBalance();
    expect(pending1.toString()).to.equal(ether("0.3").toString());

    // Deploy SelfdestructSender with 1 wei
    const Sender = await ethers.getContractFactory("SelfdestructSender");
    const sender = await Sender.deploy({ value: ethers.BigNumber.from("1") });
    await sender.deployed();

    // Trigger selfdestruct -> funds forced to MockTreasury (does NOT run its code)
    await (await sender.sendAll(mock.address)).wait();

    const bal = await ethers.provider.getBalance(mock.address);
    const pending2 = await mock.pendingBalance();

    // Balance should reflect both the normal send and the forced-send (0.3 ETH + 1 wei)
    const expected = ether("0.3").add(ethers.BigNumber.from("1"));
    expect(bal.toString()).to.equal(expected.toString());
    // pendingBalance remains only what was deposited via receive()
    expect(pending2.toString()).to.equal(ether("0.3").toString());
  });
});
