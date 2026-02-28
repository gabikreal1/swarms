// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./JobTypes.sol";

interface IOrderBookCallback {
    function onValidationComplete(uint256 jobId, bool passed, uint8 score) external;
}

contract ValidationOracle is Ownable {
    struct ValidationRequest {
        uint256 jobId;
        address validator;
        uint8 passingScore;
        bool allRequired;
        uint8 criteriaCount;
        bool completed;
        bool passed;
        uint8 score;
    }

    mapping(address => bool) public validators;
    mapping(uint256 => ValidationRequest) public validationRequests;
    address public orderBook;

    event ValidationRequested(uint256 indexed jobId, address validator);
    event ValidationSubmitted(uint256 indexed jobId, bool passed, uint8 score, bytes32 reportHash);
    event ValidatorRegistered(address validator);
    event ValidatorRemoved(address validator);

    modifier onlyOrderBook() {
        require(msg.sender == orderBook, "ValidationOracle: caller is not order book");
        _;
    }

    constructor(address _orderBook) Ownable(msg.sender) {
        orderBook = _orderBook;
    }

    function setOrderBook(address _orderBook) external onlyOwner {
        orderBook = _orderBook;
    }

    function registerValidator(address validator) external onlyOwner {
        require(validator != address(0), "ValidationOracle: zero address");
        validators[validator] = true;
        emit ValidatorRegistered(validator);
    }

    function removeValidator(address validator) external onlyOwner {
        require(validators[validator], "ValidationOracle: not a validator");
        validators[validator] = false;
        emit ValidatorRemoved(validator);
    }

    function requestValidation(
        uint256 jobId,
        address validator,
        uint8 passingScore,
        bool allRequired,
        uint8 criteriaCount
    ) external onlyOrderBook {
        require(validators[validator], "ValidationOracle: validator not registered");
        require(validationRequests[jobId].validator == address(0), "ValidationOracle: validation already requested");
        require(criteriaCount > 0, "ValidationOracle: criteria count must be positive");

        validationRequests[jobId] = ValidationRequest({
            jobId: jobId,
            validator: validator,
            passingScore: passingScore,
            allRequired: allRequired,
            criteriaCount: criteriaCount,
            completed: false,
            passed: false,
            score: 0
        });

        emit ValidationRequested(jobId, validator);
    }

    function submitValidation(
        uint256 jobId,
        uint256 criteriaPassedBitmask,
        uint8 score,
        bytes32 reportHash
    ) external {
        ValidationRequest storage request = validationRequests[jobId];
        require(request.validator == msg.sender, "ValidationOracle: not assigned validator");
        require(!request.completed, "ValidationOracle: already completed");

        bool passed;
        if (request.allRequired) {
            uint256 requiredMask = (1 << request.criteriaCount) - 1;
            passed = (criteriaPassedBitmask & requiredMask) == requiredMask;
        } else {
            passed = score >= request.passingScore;
        }

        request.completed = true;
        request.passed = passed;
        request.score = score;

        emit ValidationSubmitted(jobId, passed, score, reportHash);

        IOrderBookCallback(orderBook).onValidationComplete(jobId, passed, score);
    }

    function isValidator(address account) external view returns (bool) {
        return validators[account];
    }
}
