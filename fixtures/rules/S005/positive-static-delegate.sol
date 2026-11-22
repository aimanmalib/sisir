// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

contract StaticBridge {
    address constant BRIDGE = 0x0000000000000000000000000000000000000901;

    function peek(string calldata target, bytes calldata payload) external view returns (bytes memory) {
        (bool ok, bytes memory ret) = BRIDGE.staticcall( // expect S005
            abi.encodeWithSignature("executeCrossVMCall(uint8,string,bytes)", uint8(1), target, payload)
        );
        require(ok && ret.length > 0, "bridge failed");
        return ret;
    }

    function forward(address bridge, string calldata target, bytes calldata payload) external {
        (bool ok, ) = bridge.delegatecall(abi.encodeWithSignature("executeCrossVMCall(uint8,string,bytes)", uint8(1), target, payload)); // expect S005
        require(ok, "bridge failed");
    }
}
