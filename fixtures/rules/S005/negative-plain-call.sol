// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

contract PlainBridge {
    address constant BRIDGE = 0x0000000000000000000000000000000000000901;

    function send(string calldata target, bytes calldata payload) external returns (bytes memory) {
        (bool ok, bytes memory ret) = BRIDGE.call(abi.encodeWithSignature("executeCrossVMCall(uint8,string,bytes)", uint8(1), target, payload));
        require(ok && ret.length > 0, "bridge failed");
        return ret;
    }

    function sendWithGas(string calldata target, bytes calldata payload, uint256 g) external {
        (bool ok, bytes memory ret) = BRIDGE.call{gas: g, value: 0}(
            abi.encodeWithSignature("executeCrossVMCall(uint8,string,bytes)", uint8(1), target, payload)
        );
        require(ok && ret.length > 0, "bridge failed");
    }
}
