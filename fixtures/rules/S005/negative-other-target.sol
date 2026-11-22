// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

contract OtherTargets {
    address constant PQC_VERIFY = 0x0000000000000000000000000000000000000a01;
    address public immutable logic;

    constructor(address logic_) {
        logic = logic_;
    }

    function verify(bytes calldata payload) external view returns (bool) {
        (bool ok, bytes memory ret) = PQC_VERIFY.staticcall(payload);
        return ok && ret.length >= 32 && abi.decode(ret, (bool));
    }

    function upgradeStep(bytes calldata data) external {
        (bool ok, ) = logic.delegatecall(data);
        require(ok, "step failed");
    }
}
