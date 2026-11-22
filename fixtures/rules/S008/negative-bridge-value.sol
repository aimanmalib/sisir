// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

// Value sent to the cross-VM bridge is reported by S005, not S008.
contract BridgeValue {
    address constant BRIDGE = 0x0000000000000000000000000000000000000901;

    function pay(string calldata target, bytes calldata payload) external payable {
        (bool ok, bytes memory ret) = BRIDGE.call{value: msg.value}(
            abi.encodeWithSignature("executeCrossVMCall(uint8,string,bytes)", uint8(1), target, payload)
        );
        require(ok && ret.length > 0, "bridge failed");
    }
}
