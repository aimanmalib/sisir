// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface ICrossVm {
    function executeCrossVMCall(uint8 targetVM, string calldata targetContract, bytes calldata payload) external payable returns (bytes memory);
}

contract PaidBridge {
    address constant BRIDGE = 0x0000000000000000000000000000000000000901;

    function pay(string calldata target, bytes calldata payload) external payable {
        (bool ok, bytes memory ret) = BRIDGE.call{value: msg.value}( // expect S005
            abi.encodeWithSignature("executeCrossVMCall(uint8,string,bytes)", uint8(1), target, payload)
        );
        require(ok && ret.length > 0, "bridge failed");
    }

    function payTyped(string calldata target, bytes calldata payload) external payable {
        ICrossVm(BRIDGE).executeCrossVMCall{value: 1 ether}(1, target, payload); // expect S005
    }
}
