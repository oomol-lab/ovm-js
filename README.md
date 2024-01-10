# @oomol-lab/ovm

Manage OOMOL Virtual Machines(OVM).

## Install

```bash
# pnpm
pnpm add @oomol-lab/ovm

# yarn
yarn add @oomol-lab/ovm

# npm
npm install @oomol-lab/ovm
```

## Usage

### Simple Example

```typescript
import { createDarwinOVM, OVMStatusName } from "@oomol-lab/ovm"

function async main() {
    const ovm = await createDarwinOVM({
        cpu: 4,
        memory: 6144,
        name: "test",
        logDir: "/example/log",
        socketDir: "/example/socket",
        sshKeyDir: "/example/ssh",
        targetDir: "/example/target",
        linuxPath: {
            initrd: "/example/initrd",
            kernel: "/example/bzImage", // If it is an arm64 system, then it is `Image`.
            rootfs: "/example/rootfs.erofs",
        },
        versions: {
            initrd: "1.0.0",
            kernel: "1.0.0",
            rootfs: "1.0.0",
            dataImg: "1.0.0",
        },
        ovmPath: "/example/ovm",
    });

    ovm.on("status", async (datum) => {
        switch(datum.name) {
            case OVMStatusName.Initializing:
                console.log("Initializing");
                break;
            case OVMStatusName.GVProxyReady:
                console.log("GVProxyReady");
                break;
            case OVMStatusName.IgnitionProgress:
                console.log("IgnitionProgress");
                break;
            case OVMStatusName.IgnitionDone:
                console.log("IgnitionDone");
                break;
            case OVMStatusName.VMReady:
                console.log("VMReady");
                break;
            case OVMStatusName.Exit:
                console.log("Exit");
                break;
            case OVMStatusName.Error:
                console.log("Error:", datum.error);
                break;
        }
    })

    ovm.start();
}
```

## API

### Instance Params

#### cpu

The number of CPUs allocated to the virtual machine.

#### memory

The amount of memory allocated to the virtual machine (in MB).

#### name

The name of the virtual machine.

#### logDir

We request to provide a directory to store the logs of the latest 3 instances, for the purpose of troubleshooting.

The format of the log file name is as follows:

* ${name}-ovm.log (latest)
* ${name}-ovm.2.log
* ${name}-ovm.3.log
* ${name}-vfkit.log (latest)
* ${name}-vfkit.2.log
* ${name}-vfkit.3.log
* ...

#### socketDir

During the startup process of the virtual machine, [ovm] will create some socket files. To facilitate management, we request a directory to store these socket files. Each time the `.start()` method is called, the program will first delete the existing socket files and then recreate them.

#### sshKeyDir

Store the SSH key pairs required to connect to the virtual machine.

#### targetDir

In order to address the issues that may occur when some files are damaged or other malfunctions happen, the program will first copy the files from the `linuxPath` to this directory.

#### linuxPath

The `initrd`, `kernel`, and `rootfs` can be obtained from the [ovm-core] project.

Regarding the `kernel` field, if the system is Mac ARM64 (M series), the kernel file needs to be uncompressed (not **bzImage**). For more information on this, please refer to: [kernel arm64 booting]

#### versions

It is used to manage whether a file should be overwritten. For example, when upgrading `initrd`, it is necessary to overwrite the original `initrd` to ensure the upgrade takes effect.

#### ovmPath

The directory where the [ovm] program is located.

### Instance Methods

#### `.start()`

Start the virtual machine.

Return: `void`

#### `.requestStop()`

Request to stop the virtual machine.

#### `.stop()`

Stop the virtual machine. (FORCE SHUTDOWN)

Return: `Promise<void>`

#### `.pause()`

Pause the virtual machine.

Return: `Promise<void>`

#### `.resume()`

Resume the virtual machine.

Return: `Promise<void>`

#### `.info`

Get the host socket file for *podman*.

Return: `{ podmanSocketPath: string }`

#### `.state()`

Get the current status of the virtual machine and the values that can be changed.

Return: `Promise<{ state: "state", canStart: boolean, canPause: boolean, canResume: boolean, canRequestStop: boolean, canStop: boolean }>`

*state* values are as follows:

* VirtualMachineStateStopped
* VirtualMachineStateRunning
* VirtualMachineStatePaused
* VirtualMachineStateError
* VirtualMachineStateStarting
* VirtualMachineStatePausing
* VirtualMachineStateResuming
* VirtualMachineStateStopping
* VirtualMachineStateSaving
* VirtualMachineStateRestoring

#### `.on("status", listener)`

Add a listener function for the status event.

* `(datum: OVMEventData["status"]) => void`

[ovm]: https://github.com/oomol-lab/ovm
[ovm-core]: https://github.com/oomol-lab/ovm-core
[kernel arm64 booting]: https://www.kernel.org/doc/Documentation/arm64/booting.txt
