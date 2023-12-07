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
import { createDarwinOVM } from "@oomol-lab/ovm"

function async main() {
    const ovm = await createDarwinOVM({
        originPath: {
            gvproxy: "/example/gvproxy",
            vfkit: "/example/vfkit",
            initrd: "/example/initrd",
            kernel: "/example/bzImage", // If it is an arm64 system, then it is `Image`.
            rootfs: "/example/rootfs.btrfs", // or `/example/rootfs.btrfs.zip`
        },
        socketDir: "/example/socket",
        logDir: "/example/log",
        targetDir: "/example/target",
        sshKeyDir: "/example/ssh",
        versions: {
            gvproxy: "1.0.0",
            vfkit: "1.0.0",
            initrd: "1.0.0",
            kernel: "1.0.0",
            rootfs: "1.0.0",
        },
    });

    await ovm.start();
}
```

## API

### Instance Params

#### originPath

`gvproxy` and `vfkit` can be obtained in the *Release* section of the [ovm-osx-toolchain] project. The `initrd`, `kernel`, and `rootfs` can be obtained from the [ovm-core] project.

Regarding the `kernel` field, if the system is Mac ARM64 (M series), the kernel file needs to be uncompressed (not **bzImage**). For more information on this, please refer to: [kernel arm64 booting]

Currently, we only support the *btrfs* and *btrfs.zip* file formats for the `rootfs`. If it is a *btrfs.zip* file, we will automatically decompress it.

#### socketDir

During the startup process of the virtual machine, `gvproxy` and `vfkit` will create some socket files. To facilitate management, we request a directory to store these socket files. Each time the `.start()` method is called, the program will first delete the existing socket files and then recreate them, as `gvproxy` and `vfkit` may not automatically delete them in certain situations (such as receiving a `SIGKILL` event).

#### logDir

We request to provide a directory to store the logs of the latest 3 instances of `gvproxy` and `vfkit`, for the purpose of troubleshooting.

The format of the log file name is as follows:

* gvproxy.log (latest)
* gvproxy.2.log
* gvproxy.3.log
* vfkit.log (latest)
* vfkit.2.log
* vfkit.3.log

#### targetDir

In order to address the issues that may occur when some files are damaged or other malfunctions happen, the program will first copy the files from the `originPath` to this directory. This allows for the restoration of files by calling `.resetPath()` when problems arise. For example, when forcibly shutting down the virtual machine (power off), certain service statuses in rootfs will be affected and cannot be restored. This mechanism is used to resolve this issue.

#### sshKeyDir

Store the SSH key pairs required to connect to the virtual machine.

#### versions

It is used to manage whether a file should be overwritten. For example, when upgrading `gvproxy`, it is necessary to overwrite the original `gvproxy` to ensure the upgrade takes effect.

### Instance Methods

#### `.start()`

Start the virtual machine.

Return: `Promise<void>`

#### `.stop()`

Stop the virtual machine.

Return: `Promise<void>`

#### `.resetPath()`

Reset the files in the `targetDir` directory to the original files in the `originPath` directory. Ignore the `versions` mechanism and **force overwrite**.

#### `.info`

Get the host ports for *podman* and *ssh*.

Return: `{ podmanPort: number, sshPort: number }`

#### `.exportPort(hostPort: number, guestPort: number)`

Expose the ports of the virtual machine on a specific port on the host machine, enabling mutual communication.

Return: `Promise<void>`

#### `.clocksync()`

Synchronize the system time inside the virtual machine. This operation will first set the virtual machine time to the current time of the host machine, and then attempt to synchronize it with the ntp server using `chrony`.

Currently, synchronization will be performed with the following NTP servers (for details, please see: [ntp server]):

* pool.ntp.org
* time.apple.com
* time.windows.com

Return: `Promise<void>`

#### `.vmState()`

Get the current status of the virtual machine and the values that can be changed.

Return: `Promise<{ state: "state", canPause: boolean, canResume: boolean, canStop: boolean, canHardStop: boolean }>`

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

#### `.vmPause()`

Pause the virtual machine.

Return: `Promise<void>`

#### `.vmResume()`

Resume the virtual machine.

When the virtual machine successfully resumes from the suspended state, `.clocksync()` will be automatically invoked.

Return: `Promise<void>`

#### `.on(eventName, listener)`

Add a listener function for the specified event.

* `ready`: `() => void`
* `close`: `() => void`
* `vmPause`: `() => void`
* `vmResume`: `() => void`
* `error`: `(error: Error) => void`

## Notice

When MacOS is in sleep mode, we automatically pause the virtual machine. When it resumes from sleep mode, the virtual machine will be resumed as well. The reason for doing this is that when the MacOS is in sleep mode for more than 30-40 minutes, the virtual machine kernel may crash due to issues related to CPU clock synchronization. To avoid this problem, we automatically pause and resume the virtual machine, and after resuming, we automatically invoke `.clocksync()` for time synchronization.

[ovm-osx-toolchain]: https://github.com/oomol-lab/ovm-osx-toolchain
[ovm-core]: https://github.com/oomol-lab/ovm-core
[kernel arm64 booting]: https://www.kernel.org/doc/Documentation/arm64/booting.txt
[ntp server]: https://github.com/oomol-lab/ovm-core/blob/338c767339467724573654166131236bbb65fa6e/patches/rootfs/refactor_package_add_chrony_conf_in_chrony.patch#L14-L16
