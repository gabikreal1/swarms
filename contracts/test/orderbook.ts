import { expect } from "chai";
import { ethers } from "hardhat";

async function deployFixtures() {
  const [deployer, poster, agent, validator, outsider] = await ethers.getSigners();

  const usdc = await ethers.deployContract("MockUSDC");
  await usdc.waitForDeployment();

  const agentRegistry = await ethers.deployContract("AgentRegistry", [deployer.address]);
  const jobRegistry = await ethers.deployContract("JobRegistry", [deployer.address]);
  const reputation = await ethers.deployContract("ReputationToken", [deployer.address]);
  const escrow = await ethers.deployContract("Escrow", [deployer.address, await usdc.getAddress(), deployer.address]);
  const orderBook = await ethers.deployContract("OrderBook", [deployer.address, await jobRegistry.getAddress()]);
  const validationOracle = await ethers.deployContract("ValidationOracle", [await orderBook.getAddress()]);

  await Promise.all([
    jobRegistry.setOrderBook(orderBook.target),
    escrow.setOrderBook(orderBook.target),
    escrow.setReputation(reputation.target),
    reputation.setEscrow(escrow.target),
    reputation.setAgentRegistry(agentRegistry.target),
    agentRegistry.setReputationOracle(reputation.target),
    orderBook.setEscrow(escrow.target),
    orderBook.setReputationToken(reputation.target),
    orderBook.setAgentRegistry(agentRegistry.target),
    orderBook.setValidationOracle(validationOracle.target),
    orderBook.setDefaultValidator(validator.address),
    validationOracle.registerValidator(validator.address),
  ]);

  await agentRegistry.connect(agent).registerAgent("Research Agent", "ipfs://agent", ["research"]);

  return { deployer, poster, agent, validator, outsider, usdc, agentRegistry, jobRegistry, reputation, escrow, orderBook, validationOracle };
}

describe("A2A marketplace flow", () => {
  it("runs full happy path", async () => {
    const { poster, agent, usdc, escrow, orderBook, reputation } = await deployFixtures();

    const price = ethers.parseUnits("25", 6);
    await usdc.mint(poster.address, price);

    const jobId = await orderBook
      .connect(poster)
      .postJob.staticCall("Find restaurants", "ipfs://job", ["restaurant"], 0);
    await orderBook.connect(poster).postJob("Find restaurants", "ipfs://job", ["restaurant"], 0);

    const bidId = await orderBook
      .connect(agent)
      .placeBid.staticCall(jobId, price, 3600, "ipfs://bid-metadata");
    await orderBook.connect(agent).placeBid(jobId, price, 3600, "ipfs://bid-metadata");

    await usdc.connect(poster).approve(escrow.target, price);
    await orderBook.connect(poster).acceptBid(jobId, bidId, "ipfs://response-answers");

    const escrowBalanceAfterLock = await usdc.balanceOf(escrow.target);
    expect(escrowBalanceAfterLock).to.equal(price);

    const proof = ethers.keccak256(ethers.toUtf8Bytes("delivery"));
    await orderBook.connect(agent).submitDelivery(jobId, proof);

    await orderBook.connect(poster).approveDelivery(jobId);

    const fee = price * BigInt(200) / BigInt(10_000);
    const expectedPayout = price - fee;
    const agentBalance = await usdc.balanceOf(agent.address);
    expect(agentBalance).to.equal(expectedPayout);

    const reputationScore = await reputation.scoreOf(agent.address);
    expect(reputationScore).to.be.greaterThan(0n);

    const jobData = await orderBook.getJob(jobId);
    expect(jobData[0].status).to.equal(3); // COMPLETED
  });

  it("criteria-aware happy path", async () => {
    const { poster, agent, validator, usdc, escrow, orderBook, validationOracle, reputation } = await deployFixtures();

    const price = ethers.parseUnits("50", 6);
    await usdc.mint(poster.address, price);

    const criteriaHash = ethers.keccak256(ethers.toUtf8Bytes("criteria-spec"));
    const criteriaCount = 3;
    const allRequired = false;
    const passingScore = 70;

    // Post job with criteria
    const jobId = await orderBook
      .connect(poster)
      .postJobWithCriteria.staticCall("Analyze data", "ipfs://job2", ["analysis"], 0, criteriaHash, criteriaCount, allRequired, passingScore);
    await orderBook.connect(poster).postJobWithCriteria("Analyze data", "ipfs://job2", ["analysis"], 0, criteriaHash, criteriaCount, allRequired, passingScore);

    // Agent places bid with criteria bitmask (commits to all 3 criteria: 0b111 = 7)
    const criteriaBitmask = 7;
    const bidId = await orderBook
      .connect(agent)
      .placeBidWithCriteria.staticCall(jobId, price, 3600, "ipfs://bid", "ipfs://response", criteriaBitmask);
    await orderBook.connect(agent).placeBidWithCriteria(jobId, price, 3600, "ipfs://bid", "ipfs://response", criteriaBitmask);

    // Poster accepts bid
    await usdc.connect(poster).approve(escrow.target, price);
    await orderBook.connect(poster).acceptBid(jobId, bidId, "");

    // Agent submits delivery with evidence
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("delivery-proof"));
    const evidenceMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("evidence-root"));
    await orderBook.connect(agent).submitDeliveryWithEvidence(jobId, proofHash, evidenceMerkleRoot, "ipfs://evidence");

    // Verify job is now VALIDATING (status 5)
    let jobData = await orderBook.getJob(jobId);
    expect(jobData[0].status).to.equal(5); // VALIDATING

    // Validator submits passing validation (score 80 >= passingScore 70)
    const reportHash = ethers.keccak256(ethers.toUtf8Bytes("report"));
    await validationOracle.connect(validator).submitValidation(jobId, criteriaBitmask, 80, reportHash);

    // Verify auto-completion + payment release
    jobData = await orderBook.getJob(jobId);
    expect(jobData[0].status).to.equal(3); // COMPLETED

    const fee = price * BigInt(200) / BigInt(10_000);
    const expectedPayout = price - fee;
    const agentBalance = await usdc.balanceOf(agent.address);
    expect(agentBalance).to.equal(expectedPayout);

    // Verify reputation updated
    const repScore = await reputation.scoreOf(agent.address);
    expect(repScore).to.be.greaterThan(0n);
  });

  it("validation failure + poster override", async () => {
    const { poster, agent, validator, usdc, escrow, orderBook, validationOracle } = await deployFixtures();

    const price = ethers.parseUnits("30", 6);
    await usdc.mint(poster.address, price);

    const criteriaHash = ethers.keccak256(ethers.toUtf8Bytes("criteria"));
    const criteriaCount = 3;
    const allRequired = false;
    const passingScore = 70;

    // Post job with criteria
    const jobId = await orderBook
      .connect(poster)
      .postJobWithCriteria.staticCall("Write report", "ipfs://job3", ["writing"], 0, criteriaHash, criteriaCount, allRequired, passingScore);
    await orderBook.connect(poster).postJobWithCriteria("Write report", "ipfs://job3", ["writing"], 0, criteriaHash, criteriaCount, allRequired, passingScore);

    // Agent bids and poster accepts
    const bidId = await orderBook
      .connect(agent)
      .placeBidWithCriteria.staticCall(jobId, price, 3600, "ipfs://bid", "", 7);
    await orderBook.connect(agent).placeBidWithCriteria(jobId, price, 3600, "ipfs://bid", "", 7);

    await usdc.connect(poster).approve(escrow.target, price);
    await orderBook.connect(poster).acceptBid(jobId, bidId, "");

    // Agent submits delivery with evidence
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("delivery"));
    const evidenceMerkleRoot = ethers.keccak256(ethers.toUtf8Bytes("evidence"));
    await orderBook.connect(agent).submitDeliveryWithEvidence(jobId, proofHash, evidenceMerkleRoot, "ipfs://evidence");

    // Validator submits FAILING validation (score 40 < passingScore 70)
    const reportHash = ethers.keccak256(ethers.toUtf8Bytes("fail-report"));
    await validationOracle.connect(validator).submitValidation(jobId, 0, 40, reportHash);

    // Verify job returns to DELIVERED status (status 2)
    let jobData = await orderBook.getJob(jobId);
    expect(jobData[0].status).to.equal(2); // DELIVERED

    // Verify payment NOT released yet
    const agentBalanceBefore = await usdc.balanceOf(agent.address);
    expect(agentBalanceBefore).to.equal(0n);

    // Poster overrides and approves anyway
    await orderBook.connect(poster).approveDeliveryOverride(jobId);

    // Verify job completes + payment releases
    jobData = await orderBook.getJob(jobId);
    expect(jobData[0].status).to.equal(3); // COMPLETED

    const fee = price * BigInt(200) / BigInt(10_000);
    const expectedPayout = price - fee;
    const agentBalance = await usdc.balanceOf(agent.address);
    expect(agentBalance).to.equal(expectedPayout);
  });

  it("non-criteria jobs backward compatibility", async () => {
    const { poster, agent, usdc, escrow, orderBook, reputation } = await deployFixtures();

    const price = ethers.parseUnits("10", 6);
    await usdc.mint(poster.address, price);

    // Use original postJob (no criteria)
    const jobId = await orderBook
      .connect(poster)
      .postJob.staticCall("Simple task", "ipfs://simple", ["misc"], 0);
    await orderBook.connect(poster).postJob("Simple task", "ipfs://simple", ["misc"], 0);

    // Use original placeBid
    const bidId = await orderBook
      .connect(agent)
      .placeBid.staticCall(jobId, price, 1800, "ipfs://bid-simple");
    await orderBook.connect(agent).placeBid(jobId, price, 1800, "ipfs://bid-simple");

    await usdc.connect(poster).approve(escrow.target, price);
    await orderBook.connect(poster).acceptBid(jobId, bidId, "");

    // Use original submitDelivery
    const proof = ethers.keccak256(ethers.toUtf8Bytes("simple-delivery"));
    await orderBook.connect(agent).submitDelivery(jobId, proof);

    // Verify DELIVERED status
    let jobData = await orderBook.getJob(jobId);
    expect(jobData[0].status).to.equal(2); // DELIVERED

    // Use original approveDelivery
    await orderBook.connect(poster).approveDelivery(jobId);

    // Verify COMPLETED
    jobData = await orderBook.getJob(jobId);
    expect(jobData[0].status).to.equal(3); // COMPLETED

    const fee = price * BigInt(200) / BigInt(10_000);
    const expectedPayout = price - fee;
    const agentBalance = await usdc.balanceOf(agent.address);
    expect(agentBalance).to.equal(expectedPayout);

    // Verify reputation updated
    const repScore = await reputation.scoreOf(agent.address);
    expect(repScore).to.be.greaterThan(0n);
  });
});

describe("ValidationOracle access control", () => {
  it("only registered validators can submit validations", async () => {
    const { poster, agent, outsider, usdc, escrow, orderBook, validationOracle, validator } = await deployFixtures();

    const price = ethers.parseUnits("20", 6);
    await usdc.mint(poster.address, price);

    const criteriaHash = ethers.keccak256(ethers.toUtf8Bytes("criteria"));

    const jobId = await orderBook
      .connect(poster)
      .postJobWithCriteria.staticCall("Task", "ipfs://job", ["tag"], 0, criteriaHash, 2, false, 50);
    await orderBook.connect(poster).postJobWithCriteria("Task", "ipfs://job", ["tag"], 0, criteriaHash, 2, false, 50);

    const bidId = await orderBook
      .connect(agent)
      .placeBidWithCriteria.staticCall(jobId, price, 3600, "ipfs://bid", "", 3);
    await orderBook.connect(agent).placeBidWithCriteria(jobId, price, 3600, "ipfs://bid", "", 3);

    await usdc.connect(poster).approve(escrow.target, price);
    await orderBook.connect(poster).acceptBid(jobId, bidId, "");

    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof"));
    const evidenceRoot = ethers.keccak256(ethers.toUtf8Bytes("evidence"));
    await orderBook.connect(agent).submitDeliveryWithEvidence(jobId, proofHash, evidenceRoot, "ipfs://ev");

    // Outsider (not a validator) tries to submit validation
    const reportHash = ethers.keccak256(ethers.toUtf8Bytes("report"));
    await expect(
      validationOracle.connect(outsider).submitValidation(jobId, 3, 80, reportHash)
    ).to.be.revertedWith("ValidationOracle: not assigned validator");
  });

  it("only OrderBook can request validations", async () => {
    const { outsider, validator, validationOracle } = await deployFixtures();

    await expect(
      validationOracle.connect(outsider).requestValidation(1, validator.address, 70, false, 3)
    ).to.be.revertedWith("ValidationOracle: caller is not order book");
  });

  it("only owner can register and remove validators", async () => {
    const { outsider, validationOracle } = await deployFixtures();

    await expect(
      validationOracle.connect(outsider).registerValidator(outsider.address)
    ).to.be.reverted;

    await expect(
      validationOracle.connect(outsider).removeValidator(outsider.address)
    ).to.be.reverted;
  });

  it("owner can register and remove validators", async () => {
    const { deployer, outsider, validationOracle } = await deployFixtures();

    // Register a new validator
    await validationOracle.connect(deployer).registerValidator(outsider.address);
    expect(await validationOracle.isValidator(outsider.address)).to.equal(true);

    // Remove the validator
    await validationOracle.connect(deployer).removeValidator(outsider.address);
    expect(await validationOracle.isValidator(outsider.address)).to.equal(false);
  });

  it("non-oracle address cannot call onValidationComplete on OrderBook", async () => {
    const { outsider, orderBook } = await deployFixtures();

    await expect(
      orderBook.connect(outsider).onValidationComplete(1, true, 85)
    ).to.be.revertedWith("OrderBook: caller is not validation oracle");
  });
});

describe("All-required criteria mode", () => {
  it("fails validation when not all criteria are met, even with high score", async () => {
    const { poster, agent, validator, usdc, escrow, orderBook, validationOracle } = await deployFixtures();

    const price = ethers.parseUnits("40", 6);
    await usdc.mint(poster.address, price);

    const criteriaHash = ethers.keccak256(ethers.toUtf8Bytes("all-required-criteria"));
    const criteriaCount = 3;
    const allRequired = true;
    const passingScore = 70;

    // Post job with allRequired = true
    const jobId = await orderBook
      .connect(poster)
      .postJobWithCriteria.staticCall("Strict job", "ipfs://strict", ["strict"], 0, criteriaHash, criteriaCount, allRequired, passingScore);
    await orderBook.connect(poster).postJobWithCriteria("Strict job", "ipfs://strict", ["strict"], 0, criteriaHash, criteriaCount, allRequired, passingScore);

    // Agent bids with all 3 criteria
    const bidId = await orderBook
      .connect(agent)
      .placeBidWithCriteria.staticCall(jobId, price, 3600, "ipfs://bid", "", 0b111);
    await orderBook.connect(agent).placeBidWithCriteria(jobId, price, 3600, "ipfs://bid", "", 0b111);

    // Accept bid
    await usdc.connect(poster).approve(escrow.target, price);
    await orderBook.connect(poster).acceptBid(jobId, bidId, "");

    // Submit delivery with evidence
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("strict-delivery"));
    const evidenceRoot = ethers.keccak256(ethers.toUtf8Bytes("strict-evidence"));
    await orderBook.connect(agent).submitDeliveryWithEvidence(jobId, proofHash, evidenceRoot, "ipfs://strict-ev");

    // Verify VALIDATING
    let jobData = await orderBook.getJob(jobId);
    expect(jobData[0].status).to.equal(5); // VALIDATING

    // Validator submits with only 2 of 3 criteria passed (bitmask 0b011)
    // Score is 90 (well above passingScore), but allRequired=true means ALL criteria must pass
    const reportHash = ethers.keccak256(ethers.toUtf8Bytes("partial-report"));
    await validationOracle.connect(validator).submitValidation(jobId, 0b011, 90, reportHash);

    // Validation should FAIL because not all criteria met -> DELIVERED (2)
    jobData = await orderBook.getJob(jobId);
    expect(jobData[0].status).to.equal(2); // DELIVERED

    // Payment NOT released
    const agentBalance = await usdc.balanceOf(agent.address);
    expect(agentBalance).to.equal(0n);
  });

  it("passes validation when all criteria are met", async () => {
    const { poster, agent, validator, usdc, escrow, orderBook, validationOracle, reputation } = await deployFixtures();

    const price = ethers.parseUnits("40", 6);
    await usdc.mint(poster.address, price);

    const criteriaHash = ethers.keccak256(ethers.toUtf8Bytes("all-required-pass"));
    const criteriaCount = 3;
    const allRequired = true;
    const passingScore = 70;

    // Post job with allRequired = true
    const jobId = await orderBook
      .connect(poster)
      .postJobWithCriteria.staticCall("Strict job pass", "ipfs://strict2", ["strict"], 0, criteriaHash, criteriaCount, allRequired, passingScore);
    await orderBook.connect(poster).postJobWithCriteria("Strict job pass", "ipfs://strict2", ["strict"], 0, criteriaHash, criteriaCount, allRequired, passingScore);

    // Agent bids
    const bidId = await orderBook
      .connect(agent)
      .placeBidWithCriteria.staticCall(jobId, price, 3600, "ipfs://bid", "", 0b111);
    await orderBook.connect(agent).placeBidWithCriteria(jobId, price, 3600, "ipfs://bid", "", 0b111);

    // Accept bid
    await usdc.connect(poster).approve(escrow.target, price);
    await orderBook.connect(poster).acceptBid(jobId, bidId, "");

    // Submit delivery
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("strict-delivery-pass"));
    const evidenceRoot = ethers.keccak256(ethers.toUtf8Bytes("strict-evidence-pass"));
    await orderBook.connect(agent).submitDeliveryWithEvidence(jobId, proofHash, evidenceRoot, "ipfs://strict-ev2");

    // Validator submits with ALL 3 criteria passed (bitmask 0b111)
    const reportHash = ethers.keccak256(ethers.toUtf8Bytes("full-report"));
    await validationOracle.connect(validator).submitValidation(jobId, 0b111, 85, reportHash);

    // Validation passes -> COMPLETED (3)
    const jobData = await orderBook.getJob(jobId);
    expect(jobData[0].status).to.equal(3); // COMPLETED

    // Payment released
    const fee = price * BigInt(200) / BigInt(10_000);
    const expectedPayout = price - fee;
    const agentBalance = await usdc.balanceOf(agent.address);
    expect(agentBalance).to.equal(expectedPayout);

    // Reputation updated
    const repScore = await reputation.scoreOf(agent.address);
    expect(repScore).to.be.greaterThan(0n);
  });
});
