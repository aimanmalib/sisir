// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

contract NoValue {
    address constant PQC_VERIFY = 0x0000000000000000000000000000000000000a01;
    address payable public treasury;

    constructor(address payable treasury_) {
        treasury = treasury_;
    }

    function verify(bytes calldata payload) external returns (bool) {
        (bool ok, bytes memory ret) = PQC_VERIFY.call{value: 0}(payload);
        return ok && ret.length >= 32 && abi.decode(ret, (bool));
    }

    function pay(uint256 amount) external {
        treasury.transfer(amount);
        (bool ok, ) = treasury.call{value: amount}("");
        require(ok, "pay failed");
    }
}
