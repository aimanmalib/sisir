// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

contract ValueToPrecompile {
    address constant PQC_VERIFY = 0x0000000000000000000000000000000000000a01;
    address constant PQC_KEYS = 0x0000000000000000000000000000000000000a02;

    function verifyPaid(bytes calldata payload) external payable returns (bool) {
        (bool ok, bytes memory ret) = PQC_VERIFY.call{value: msg.value}(payload); // expect S008
        return ok && ret.length >= 32 && abi.decode(ret, (bool));
    }

    function tip(uint256 amount) external {
        payable(PQC_KEYS).transfer(amount); // expect S008
    }

    function tipRisk(uint256 amount) external returns (bool) {
        return payable(address(0x0000000000000000000000000000000000000b01)).send(amount); // expect S008
    }
}
