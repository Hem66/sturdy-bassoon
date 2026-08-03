const { expect } = require("chai");
const { ethers } = require("hardhat");

async function logGasEstimate(label, tx) {
  const gas = await ethers.provider.estimateGas(tx);
  const gasPrice = await ethers.provider.getGasPrice();
  const estimatedCost = gasPrice.mul(gas);
  console.log(
    `[gas] ${label} | estimate=${gas.toString()} | gasPrice=${gasPrice.toString()} wei | estCost=${ethers.utils.formatEther(estimatedCost)} ETH`
  );
}

describe("MockTreasury", function () {
  let MockTreasury;
  let ReentrantRecipient;
  let treasury;
  let owner;
  let attacker;
  let safeRecipient;

  beforeEach(async function () {
    [owner, attacker, safeRecipient] = await ethers.getSigners();

    MockTreasury = await ethers.getContractFactory("MockTreasury");
    ReentrantRecipient = await ethers.getContractFactory("ReentrantRecipient");

    const deploymentTx = MockTreasury.getDeployTransaction();
    await logGasEstimate("MockTreasury deployment", {
      from: owner.address,
      data: deploymentTx.data,
      value: deploymentTx.value || 0,
    });

    treasury = await MockTreasury.deploy();
    await treasury.deployed();

    await logGasEstimate("fund treasury", {
      from: owner.address,
      to: treasury.address,
      value: ethers.utils.parseEther("1"),
    });

    await owner.sendTransaction({
      to: treasury.address,
      value: ethers.utils.parseEther("1"),
    });
  });

  it("allows old recipient to withdraw after recipient change due to stale outletLookup", async function () {
    const staleRecipient = "0x7c982346e5bF9A5272cf9cF4A1Dd391478f0E694";
    await ethers.provider.send("hardhat_impersonateAccount", [staleRecipient]);
    await ethers.provider.send("hardhat_setBalance", [
      staleRecipient,
      "0x8AC7230489E80000", // 10 ETH
    ]);
    const staleSigner = await ethers.getSigner(staleRecipient);

    await logGasEstimate("setRecipient", {
      from: owner.address,
      to: treasury.address,
      data: treasury.interface.encodeFunctionData("setRecipient", [safeRecipient.address]),
    });
    await treasury.connect(owner).setRecipient(safeRecipient.address);

    await logGasEstimate("takeBalance", {
      from: staleRecipient,
      to: treasury.address,
      data: treasury.interface.encodeFunctionData("takeBalance"),
    });
    await treasury.connect(staleSigner).takeBalance();

    expect(await ethers.provider.getBalance(treasury.address)).to.deep.equal(
      ethers.constants.Zero
    );
    expect(await treasury.pendingBalance()).to.deep.equal(
      ethers.constants.Zero
    );

    await ethers.provider.send("hardhat_stopImpersonatingAccount", [staleRecipient]);
  });

  it("allows reentrancy when the treasury holds extra balance to pay a second withdraw", async function () {
    const reentrant = await ReentrantRecipient.deploy(treasury.address);
    const selfdestructSenderFactory = await ethers.getContractFactory("SelfdestructSender");
    const selfdestructSender = await selfdestructSenderFactory.deploy({
      value: ethers.utils.parseEther("1"),
    });

    await selfdestructSender.sendAll(treasury.address);
    await logGasEstimate("setRecipient (reentrancy test)", {
      from: owner.address,
      to: treasury.address,
      data: treasury.interface.encodeFunctionData("setRecipient", [reentrant.address]),
    });
    await treasury.connect(owner).setRecipient(reentrant.address);

    await logGasEstimate("reentrant attack", {
      from: owner.address,
      to: reentrant.address,
      data: reentrant.interface.encodeFunctionData("attack"),
    });
    await reentrant.attack();

    expect(await ethers.provider.getBalance(treasury.address)).to.deep.equal(
      ethers.constants.Zero
    );
    expect(await treasury.pendingBalance()).to.deep.equal(
      ethers.constants.Zero
    );
    expect(await ethers.provider.getBalance(reentrant.address)).to.deep.equal(
      ethers.utils.parseEther("2")
    );
  });
});
