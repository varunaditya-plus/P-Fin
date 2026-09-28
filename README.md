<div align="center">

<div alt style="text-align: center; transform: scale(.25);">
	<picture>
		<source media="(prefers-color-scheme: dark)" srcset="https://github.com/varunaditya-plus/P-Fin/raw/main/assets/logo_dark.png" />
		<img alt="P-Fin Logo" src="https://github.com/varunaditya-plus/P-Fin/raw/main/assets/logo_light.png" style="width: 170px;" />
	</picture>
</div>

# P-Fin
![GitHub License](https://www.shieldcn.dev/github/license/varunaditya-plus/P-Fin.svg?variant=outline&size=sm)
[![GitHub Downloads (all assets, all releases)](https://shieldcn.dev/github/downloads/varunaditya-plus/P-Fin.svg?variant=outline&size=sm)](https://github.com/varunaditya-plus/P-Fin/releases/latest)
[![GitHub Release](https://shieldcn.dev/github/release/varunaditya-plus/P-Fin.svg?size=sm)](https://github.com/varunaditya-plus/P-Fin/releases/latest)
![Please star this repo](https://shieldcn.dev/badge/★%20please%20star-22c55e.svg?theme=amber&color=eab308&size=sm&variant=outline)

A brand new web client for Jellyfin, built using the P-Stream (or movie-web) interface as a base, and adapted for your Jellyfin server. This web client includes a Seerr integration for discovering and requesting media, eliminating the need for needing two sites.

</div>

<!-- <div align="center" style="width:100%;">
  <video src="..."></video>
</div> -->

---

## Features

- **Jellyfin library:** Signs in to your server and shows Continue watching, Next up, latest additions, and favourites. Search the library, or open one and filter by genre, year, watched status, and sort order.
- **Playback:** Plays movies and episodes from Jellyfin and reports progress back to the server, with optional next-episode autoplay. The player includes Chromecast, SyncPlay, gamepad controls, trickplay, captions, picture and audio adjustments, and downloads.
- **Seerr discover:** Browses movies and series on a connected Seerr server and requests a title or season from the same client.
- **Taste profile:** An optional quiz and title ratings shape recommendations on Discover and on the taste page. Discover can also recommend from your Jellyfin watch history when the quiz is off.
- **Home layout:** Reorder home rows, switch between carousels and grids, and change poster size. A featured carousel of library titles can sit above the rows.
- **Details and library tools:** Opens movies, series, seasons, episodes, and people. When your Jellyfin account has permission, you can edit metadata, images, subtitles, identification, collections, and playlists.
- **Watch history:** Import a Letterboxd export into Jellyfin, sync watched status with Simkl in either direction, and check whether the Jellyfin Trakt plugin is linked.
- **Themes and settings:** Switch themes or build a custom palette, set caption appearance and interface language, and export settings or sync them with the Jellyfin account.

## Installation

P-Fin runs as one container alongside an existing Jellyfin server. Seerr is optional. Your media and playback progress stay in Jellyfin; P-Fin does not need media folders, a database, GPU access or a persistent container volume. It can run on the same NAS as Jellyfin or on another computer that can reach it.

The image is built for Intel/AMD (`linux/amd64`), ARM64 (`linux/arm64`) and ARMv7 (`linux/arm/v7`). Your device must support Linux containers and one of those architectures. A NAS brand alone does not guarantee that every model supports Docker.

> The pull-based instructions use `varunadityaaga/p-fin:latest`. This tag must be published to Docker Hub before these installations can download it. Until then, use [Build locally](#build-locally). P-Fin does not need a separate app-store listing to run as a custom container.

### General guide for most devices

**1. Find your server addresses.** Open Jellyfin and note its server address, for example `http://192.168.1.10:8096`. Use the server address without `/web/index.html`. If you use Seerr, note its address too, for example `http://192.168.1.10:5055`. These can be on different machines. Do not put passwords or API keys in the configuration below.

**2. Enable containers.** Install your NAS's Docker/container application, or [Docker Engine and Compose](https://docs.docker.com/engine/install/) on a Linux server. Windows and macOS can use Docker Desktop. The dropdowns below explain the platform-specific steps.

**3. Create a P-Fin project.** In your container manager, create a Compose project, stack or custom application. Paste the following YAML and replace the example server addresses. Leave `SEERR_URL` empty if you do not use Seerr.

```yaml
services:
  p-fin:
    image: varunadityaaga/p-fin:latest
    environment:
      JELLYFIN_URL: "http://192.168.1.10:8096"
      SEERR_URL: ""
    ports:
      - "8080:8080"
    restart: unless-stopped
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
```

The left port is the port you open on your NAS. If `8080` is occupied, change the mapping to `"8088:8080"` and open port `8088` instead. Keep the right, **container port** at `8080`.

This example has the settings written directly into the YAML so it also works in editors that do not load `.env` files. Alternatively, download [docker-compose.yaml](docker-compose.yaml) and [example.env](example.env), rename `example.env` to `.env`, and keep both files in the same project folder.

**4. Deploy it.** Use your manager's **Deploy**, **Create**, **Install** or **Up** action. If you are using a terminal, save the example as `compose.yaml` in a `p-fin` folder, open that folder and run:

```sh
docker compose config --quiet
docker compose up -d
docker compose ps
```

Run these commands on the Docker host, or in the Linux VM hosting Docker. Use `sudo` if your Linux account requires it to access Docker.

**5. Open P-Fin.** Visit `http://YOUR-NAS-IP:8080` from a browser on your network. Choose **Use configured server**, sign in with your Jellyfin account, then enable Seerr or skip it. If enabled, each user signs in to Seerr through the interface. On the computer running Docker, `http://localhost:8080` also works; on another device, use the server's IP address.

**6. Update when needed.** In a container manager, pull the new image and recreate/redeploy the container with the same settings. A restart alone does not download an update. With Compose, run these commands from the project folder:

```sh
docker compose pull
docker compose up -d
```

Keep your Compose file and `.env` as the installation backup. Export any browser-only preferences from P-Fin or sync them to Jellyfin. Updating the container does not require moving your media.

### Settings for container forms

If your platform uses a form instead of a YAML editor, enter these values:

| Setting | Value |
| --- | --- |
| Name | `p-fin` |
| Image / repository | `varunadityaaga/p-fin` |
| Tag | `latest`, or a published version tag |
| Container port | `8080`, TCP |
| Host / published port | `8080`, or another unused port such as `8088` |
| Network | Default bridge network with a published port |
| `JELLYFIN_URL` environment variable | Your Jellyfin server URL |
| `SEERR_URL` environment variable | Your Seerr URL, or omit/leave empty |
| Restart policy | `unless-stopped`; enable the platform's container autostart where provided |
| Volumes, media paths and devices | None |
| Command, entrypoint and user | Leave the image defaults; it already runs without root |
| Web shortcut | `http://YOUR-NAS-IP:8080/`, using your chosen host port |

There are no `PUID` or `PGID` settings. The Compose example uses a read-only filesystem with writable temporary space at `/tmp`. If you enable read-only mode manually, add a **tmpfs mount at `/tmp`** as well. A basic container form can use its normal writable filesystem when it has no tmpfs control.

### NAS platforms

<details>
<summary><strong>Synology — DSM Container Manager and older Docker packages</strong></summary>

1. Install **Container Manager** from Package Center on a supported NAS.
2. In File Station, create a project folder such as `docker/p-fin`.
3. Open **Container Manager → Project → Create**. Name the project `p-fin`, select that folder, and use the YAML editor or upload a Compose file containing the general example above.
4. Edit the Jellyfin/Seerr addresses and host port. Complete the wizard and start the project. Web Station is not required for direct access through the published port.
5. Open `http://YOUR-SYNOLOGY-IP:8080`.

For an older DSM installation with the **Docker** package and no Project page, download the image through its registry/image interface, launch a container and enter the values in **Settings for container forms** above. Enable automatic restart. The installation does not need a volume mapping.

For updates, download the new image and redeploy with the saved project/container settings. On installations with Compose available over SSH, the general update commands can be run from the project folder.

[Synology: Compose projects](https://kb.synology.com/en-global/DSM/help/ContainerManager/docker_project).

</details>

<details>
<summary><strong>QNAP — QTS / QuTS hero and Container Station</strong></summary>

1. Install **Container Station** from App Center on a supported QNAP model.
2. In Container Station 3, open **Applications → Create** and name the application `p-fin`.
3. Paste the general Compose example. Replace the server addresses and choose an unused host port: QNAP's own web interface may already use `8080`, so `"8088:8080"` is often a useful choice.
4. Use **Validate**, then **Create**. If configuring a web shortcut, select the `p-fin` service and its container port `8080`.
5. Open `http://YOUR-QNAP-IP:8088` if you used the alternative mapping.

Use the application's YAML editing/recreation controls to retain its settings when updating. Pull the new image before recreating it. On older versions without the application editor, create a single container using the form settings above.

[QNAP: Container Station 3 applications](https://www.qnap.com/en/how-to/tutorial/article/how-to-use-container-station-3).

</details>

<details>
<summary><strong>UGREEN — UGOS Pro Docker</strong></summary>

1. Install and open **Docker** from the UGOS Pro App Center on a supported model.
2. Open **Project → Create** and name the project `p-fin`.
3. Choose a project location and upload/paste a Compose file using the general example. Write the server URLs directly into the YAML rather than relying on an `.env` file the wizard has not imported.
4. Deploy the project and wait for its container to start.
5. Open `http://YOUR-UGREEN-IP:8080`, or the host port you selected.

Manage updates from the Docker application: pull the new image, then recreate the project/container with the saved YAML. Use its container logs if deployment fails. No media-share mapping is needed, even when Jellyfin is installed on the same UGREEN NAS.

[UGREEN: Docker app overview](https://support.ugnas.com/detail/article/en-US/236) · [UGREEN: project deployment example](https://support.ugnas.com/detail/article/en-US/507).

</details>

<details>
<summary><strong>ASUSTOR — ADM, Docker Engine and Portainer CE</strong></summary>

1. Open ADM's **App Central** and install **Portainer CE**. On supported models, App Central installs Docker Engine as its dependency if needed.
2. Open Portainer from ADM and complete the login/setup shown by your installed version. Recent packages provide the initial administrator credentials in the location described by ASUSTOR's guide.
3. Select the local Docker environment, then **Stacks → Add stack → Web editor**.
4. Name the stack `p-fin`, paste the general Compose example, set your server URLs and deploy it.
5. Open `http://YOUR-ASUSTOR-IP:8080`.

Manage P-Fin updates through this stack in Portainer. The Portainer dropdown below covers environment files and redeployment. P-Fin does not need access to your ADM shared folders.

[ASUSTOR: introduction to Portainer](https://www.asustor.com/online/College_topic?topic=145).

</details>

<details>
<summary><strong>TerraMaster — TOS Container Manager / Docker Manager</strong></summary>

1. Install **Docker Engine** and **Container Manager** from the TOS application centre. Older releases call the manager **Docker Manager**.
2. Open **Projects → Add**. Enter `p-fin` as the name and choose a project folder.
3. Upload the general Compose example or choose **Create YAML File** and paste it. Set the server addresses and host port.
4. Validate the YAML, apply it, and start the project if it is not already running.
5. Open `http://YOUR-TNAS-IP:8080`.

Use the saved project for subsequent changes and image updates. If the installed manager only offers individual containers, use the form settings above. Leave command, entrypoint and user overrides empty.

[TerraMaster: Container Manager](https://help.terra-master.com/docs/TOS7/application/container-manager).

</details>

<details>
<summary><strong>Unraid</strong></summary>

1. Enable Docker under **Settings → Docker**, then open **Docker → Add Container**.
2. Name it `p-fin` and set **Repository** to `varunadityaaga/p-fin:latest`. A Community Applications template is not required.
3. Use bridge networking. Add a TCP port with container port `8080` and an unused host port, such as `8080` or `8088`.
4. Add variables named `JELLYFIN_URL` and, optionally, `SEERR_URL` with your server URLs. Do not add media paths, `/config`, GPU devices, `PUID` or `PGID`.
5. Apply the settings and enable **Autostart** on the Docker page. Open the selected host port in your browser. In advanced view, an optional WebUI shortcut is `http://[IP]:[PORT:8080]/`.

Use Unraid's Docker **Check for Updates / Update** controls to pull and recreate the container. If you already manage Compose stacks through Dockge or Portainer on Unraid, use that manager's dropdown instead.

[Unraid: container configuration](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/).

</details>

<details>
<summary><strong>TrueNAS Community Edition / SCALE — Docker-based Apps, 24.10 and later</strong></summary>

1. Configure the **Apps** storage pool if you have not already done so. This is TrueNAS's app storage; P-Fin needs no additional media dataset or application volume.
2. Open **Apps → Discover Apps**. Use the three-dot menu beside the custom-app controls and select **Install via YAML**.
3. Choose an application name such as `pfin` and paste the general Compose example into **Custom Config**.
4. Enter real server URLs directly in the YAML. Save to deploy, then check that the application is running.
5. Open `http://YOUR-TRUENAS-IP:8080`.

Manage this installation through TrueNAS Apps, including its update/redeployment controls. Do not also manage the same container from a second Compose tool. SCALE releases before 24.10 used Kubernetes; this Compose procedure is not for those releases. TrueNAS CORE users should use the separate legacy/FreeBSD instructions below.

[TrueNAS: custom apps and YAML installation](https://apps.truenas.com/managing-apps/installing-custom-apps/).

</details>

<details>
<summary><strong>HexOS</strong></summary>

1. Open HexOS Deck and use **Settings → TrueNAS** to open the underlying TrueNAS interface.
2. Sign in with the administrator account configured for that installation.
3. Follow the **TrueNAS** dropdown above to install a custom YAML application named `pfin`.
4. Enter the address of the actual Jellyfin service. If Jellyfin is another app on this server, use its reachable NAS address and published port.
5. Open P-Fin using the NAS IP and the port you published.

Manage this custom application through TrueNAS. It is not a HexOS-curated P-Fin app; a dashboard/catalog entry and its lifecycle controls should not be assumed. Existing HexOS-managed Jellyfin settings do not need to change.

[HexOS: accessing TrueNAS and managing application issues](https://docs.hexos.com/troubleshooting/apps.html) · [TrueNAS custom apps](https://apps.truenas.com/managing-apps/installing-custom-apps/).

</details>

<details>
<summary><strong>OpenMediaVault — OMV-Extras Compose plugin</strong></summary>

1. Follow the OMV-Extras instructions for your OMV version to install **openmediavault-compose** and its Docker dependencies.
2. Under **Services → Compose → Settings**, select a shared folder for Compose files and apply the settings. This stores installation definitions, not P-Fin's media.
3. Open **Services → Compose → Files**, add a file named `p-fin`, and paste the general Compose example.
4. Set the URLs and host port, save, then select the file and use **Up**. Check the logs/status from the Compose plugin.
5. Open `http://YOUR-OMV-IP:8080`.

To update, select this Compose file and use **Pull**, followed by **Up**. You can also use the repository's variable-based Compose file with the plugin's corresponding environment-file editor.

[OMV 8 Compose plugin](https://wiki.omv-extras.org/doku.php?id=omv8:omv8_plugins:docker_compose) · [OMV 7 Compose plugin](https://wiki.omv-extras.org/doku.php?id=omv7:omv7_plugins:docker_compose).

</details>

<details>
<summary><strong>Rockstor</strong></summary>

Rockstor's Rock-ons run Docker containers but use their own application definitions. This repository does not include a P-Fin Rock-on definition.

1. Set up Rockstor's Docker/Rock-ons service using the instructions for your installed version.
2. For a custom installation, use an existing Portainer/Dockge instance connected to that Docker engine, or an administrator terminal with Docker access.
3. Deploy the general Compose example through that manager. If Compose is not installed, use the single-container command in the **Linux / DIY servers** dropdown below.
4. Open `http://YOUR-ROCKSTOR-IP:8080`.

Keep this custom container's lifecycle in the tool that created it; it will not gain a Rock-ons management entry merely by running the image. Keep your deployment settings for recreating it after image updates.

[Rockstor's Rock-on registry and framework](https://github.com/rockstor/rockon-registry).

</details>

<details>
<summary><strong>Proxmox VE — Linux VM</strong></summary>

1. Create or use a Debian/Ubuntu **VM** with a network interface on your normal LAN bridge, usually `vmbr0`.
2. Install Docker Engine and the Compose plugin inside the VM, following Docker's instructions for that Linux distribution.
3. Copy the general Compose example into a project folder inside the VM and set the upstream URLs to addresses reachable from that VM.
4. Run the general deployment commands there. Enable **Start at boot** for the VM in Proxmox, and make sure Docker starts with the guest OS.
5. Open `http://YOUR-VM-IP:8080`, using the VM's address rather than the Proxmox management address.

Proxmox recommends a QEMU VM for Docker application containers. If you already maintain Docker inside an LXC, the same P-Fin configuration can be used once that environment is working, but nesting, storage and startup belong to the LXC setup. P-Fin needs no disk, media or GPU passthrough.

[Proxmox: system containers versus application containers](https://pve.proxmox.com/pve-docs/chapter-pct.html) · [Docker Engine installation](https://docs.docker.com/engine/install/).

</details>

### Container managers and home-server dashboards

<details>
<summary><strong>Portainer CE / BE</strong></summary>

1. Select the Docker **Standalone** environment that should run P-Fin.
2. Open **Stacks → Add stack → Web editor** and name it `p-fin`.
3. Paste the general Compose example and enter your server URLs directly in the YAML. Alternatively, paste the repository's Compose file and add `JELLYFIN_URL`, `SEERR_URL` and `PFIN_PORT` in Portainer's **Environment variables** section, or load your `.env` there.
4. Choose **Deploy the stack** and open the Docker host's IP at the published port.
5. For updates, open the stack's editor, choose **Update the stack**, and enable the option to re-pull the image when offered.

A local `.env` on your laptop is not automatically available to Portainer. No registry password is required for an already-published public image. These instructions use Docker Standalone; Swarm stacks have different Compose support.

[Portainer: create a stack](https://docs.portainer.io/user/docker/stacks/add) · [Edit/update a stack](https://docs.portainer.io/user/docker/stacks/edit).

</details>

<details>
<summary><strong>Dockge</strong></summary>

1. Open Dockge and select the Docker host/agent where P-Fin should run.
2. Use **+ Compose** to create a stack named `p-fin`.
3. Paste the general example into its Compose editor. Set the URLs and port, then deploy.
4. Open `http://YOUR-DOCKER-HOST-IP:8080`.

If importing files instead, place the definition at `<Dockge stacks directory>/p-fin/compose.yaml`; the default stacks directory is `/opt/stacks`. Keep any `.env` beside that file and use Dockge's scan/import control to pick it up. The host and Dockge container must agree on the stack-directory path.

Use the stack's image-update controls to update it, or run the general Compose update commands from that stack directory. Avoid creating another independent container with the same host port.

[Dockge: installation, stack storage and updates](https://github.com/louislam/dockge).

</details>

<details>
<summary><strong>CasaOS — including ZimaBoard / ZimaBlade running CasaOS</strong></summary>

1. Open the dashboard's **+** menu and choose **Install a customized app**.
2. Use **Import**, choose Docker Compose, and paste the general example with the addresses already filled in.
3. Review the imported image, port and environment variables. Set the display name to `P-Fin` and the web shortcut to HTTP on the published host port, with path `/`.
4. Complete installation and open `http://YOUR-CASAOS-IP:8080`.

If your version's form does not preserve Compose options such as `tmpfs`, deploy through Portainer/Dockge instead, or use a basic custom container with the form settings above. Do not enable a read-only filesystem without writable `/tmp`.

Update by pulling the new image and recreating the app with its saved settings. Keep a copy of the Compose definition because this is a custom app rather than a P-Fin app-store package.

[CasaOS: custom applications](https://wiki.casaos.io/en/apps).

</details>

<details>
<summary><strong>ZimaOS — ZimaCube, ZimaBoard and other supported hardware</strong></summary>

1. In the app area, choose **Install a Customized App**, then **Import** and the Docker Compose option.
2. Paste the general example. Fill the server addresses in the YAML before importing; no separate `.env` upload is necessary.
3. Review the imported settings, name the app `P-Fin`, and set its web shortcut to the host port you selected with path `/`.
4. Install, then open `http://YOUR-ZIMAOS-IP:8080`.

Preserve the `/tmp` tmpfs mount when retaining `read_only: true`. If the form cannot represent those advanced settings, use its Compose editor or a normal writable custom container. Manage later image updates using the same custom-app configuration. A community store is not required for this installation.

[ZimaOS: custom Compose import](https://www.zimaspace.com/docs/zimaos/casaos-to-zimaos-migration) · [ZimaOS container features](https://www.zimaspace.com/docs/zimaos/features).

</details>

<details>
<summary><strong>Umbrel — umbrelOS, Umbrel Home and Umbrel Pro</strong></summary>

1. Install **Portainer** from Umbrel's App Store and complete the login setup provided by Umbrel.
2. In Portainer, create a stack named `p-fin` using the general Compose example.
3. Enter Jellyfin/Seerr URLs reachable from that Docker environment and choose a free host port.
4. Deploy and open `http://umbrel.local:8080`, or the Umbrel's LAN IP and chosen port.

Umbrel's supported custom-container route is Portainer. These containers are managed there and do not automatically appear as normal Umbrel home-screen apps. Keep Portainer installed: Umbrel documents that uninstalling it removes its custom containers. Retain the Compose definition for recovery. No persistent P-Fin volume is needed.

[Umbrel: running custom Docker containers](https://umbrel.com/support/apps/running-custom-docker-containers).

</details>

<details>
<summary><strong>Runtipi</strong></summary>

1. On a release with custom applications, open **Apps → Add custom app**. This feature was introduced in Runtipi 4.5.
2. Create a single service using `varunadityaaga/p-fin:latest` and set its internal web port to `8080`.
3. Add `JELLYFIN_URL` and optional `SEERR_URL`. No volume or device mappings are required.
4. Configure a free published port using the container-form settings above, or use Runtipi's own app URL routed to container port `8080`.
5. Install and open the selected address. Use a hostname with path `/` if enabling its reverse proxy.

Use the custom app's management controls for changes and updates. A custom app store is not needed for a personal installation. Older versions without this feature can use an existing Portainer/Dockge setup or the general Docker instructions on the host.

[Runtipi: custom application support](https://runtipi.io/docs/reference/release-notes#450) · [How Runtipi applications work](https://runtipi.io/docs/learn/apps-and-app-store).

</details>

<details>
<summary><strong>Cosmos Server</strong></summary>

1. In **ServApps**, use **Import Docker Compose** and paste the general example with your real server URLs.
2. Create the service and verify its image, variables and container port `8080`.
3. Add a **SERVAPP** URL pointing to P-Fin on port `8080`. Use a dedicated hostname and leave the path prefix empty.
4. Open that URL and complete Jellyfin/Seerr setup.

Cosmos can isolate a service's network and remove its published host port. If you use that mode, open its configured Cosmos URL rather than expecting `NAS-IP:8080` to remain available. The service still needs an outbound route to Jellyfin and Seerr. Use **Update** in ServApps to pull and recreate the image; a plain restart keeps the existing image.

[Cosmos: Compose import and service updates](https://docs.cosmos-cloud.io/guides/servapps/) · [Cosmos: URL routing](https://docs.cosmos-cloud.io/guides/urls/).

</details>

### Computers, virtual machines and other setups

<details>
<summary><strong>Linux / DIY servers — Ubuntu, Debian, Fedora, mini PCs and repurposed PCs</strong></summary>

Install Docker Engine and the Compose plugin using the instructions for your distribution, then follow the general guide. Intel NUCs, Beelink/Minisforum mini PCs, HP/Dell/Lenovo thin clients and home-built NAS systems use the instructions for their operating system, not a special P-Fin image. Ensure Docker starts at boot.

If you prefer a single Docker command instead of Compose, replace the addresses and run:

```sh
docker run -d --name p-fin --restart unless-stopped \
  -p 8080:8080 \
  -e JELLYFIN_URL="http://192.168.1.10:8096" \
  -e SEERR_URL="" \
  --read-only --tmpfs /tmp --cap-drop ALL \
  --security-opt no-new-privileges:true \
  varunadityaaga/p-fin:latest
```

Open the Linux host's IP at port `8080`. For this `docker run` installation, update by pulling the image, stopping/removing only the `p-fin` container, then repeating the saved command. Compose is easier to maintain because it keeps the settings in a file.

[Docker: supported Linux distributions](https://docs.docker.com/engine/install/) · [Compose installation](https://docs.docker.com/compose/install/linux/).

</details>

<details>
<summary><strong>Raspberry Pi, Orange Pi, ODROID and other ARM boards — Raspberry Pi OS, Armbian or DietPi</strong></summary>

1. Use a supported Linux distribution for your board. Prefer a 64-bit OS on hardware that supports it.
2. Install Docker and Compose using that distribution's instructions. For 64-bit Raspberry Pi OS, Docker directs users to its Debian `arm64` packages. On DietPi, select Docker and Docker Compose through `dietpi-software`.
3. Follow the general Compose guide and open `http://YOUR-BOARD-IP:8080`.
4. Leave the platform/architecture selection automatic. Docker selects the image matching the OS, which can differ from the CPU's maximum capability.

The image also targets ARMv7, but not ARMv6 boards or 32-bit x86. Docker's Raspberry Pi OS-specific 32-bit packages stop at Engine v28; consult its current migration guidance for 32-bit systems. P-Fin does not transcode video on the board: Jellyfin performs any required transcoding on its own server.

[Docker: Raspberry Pi OS and architecture guidance](https://docs.docker.com/engine/install/raspberry-pi-os/) · [DietPi software installation](https://dietpi.com/docs/dietpi_tools/software_installation/).

</details>

<details>
<summary><strong>Windows — Docker Desktop with Linux containers</strong></summary>

1. Install Docker Desktop using its Windows instructions and enable a supported Linux-container backend, such as WSL 2. P-Fin is a Linux image, not a Windows container.
2. Start Docker Desktop. Create a `p-fin` folder, save the general example as `compose.yaml`, and edit the server addresses.
3. Open PowerShell or a Docker-enabled WSL terminal in that folder and run the general Compose commands.
4. Open `http://localhost:8080` on the PC. Other devices use `http://YOUR-PC-LAN-IP:8080`; allow that port on your private-network firewall if needed.
5. Keep Docker Desktop running and configure its startup preference for your setup. A container restart policy does not start Docker Desktop itself.

If Jellyfin runs directly on this Windows PC, prefer its LAN IP for a URL usable by both the container and your other devices. Docker Desktop also supports `host.docker.internal` for container-to-host access, but that name is not a portable link for other browsers. Windows Server users can run Docker Engine inside a Linux VM instead.

[Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/) · [Container/host networking](https://docs.docker.com/desktop/features/networking/).

</details>

<details>
<summary><strong>macOS — Mac mini, Intel Macs and Apple silicon</strong></summary>

1. Install the matching Intel or Apple-silicon edition of Docker Desktop and start it. An already-configured Docker-compatible Linux VM can also host the same image.
2. Create a `p-fin` folder and save the general example as `compose.yaml`.
3. Enter the Jellyfin/Seerr addresses, open Terminal in the folder, and run the general Compose commands.
4. Open `http://localhost:8080` on the Mac or `http://YOUR-MAC-LAN-IP:8080` on another device.
5. Configure your container runtime to start when required and keep the Mac awake while it is serving P-Fin.

Image architecture is selected automatically: ARM64 on Apple silicon, AMD64 on Intel. For Jellyfin installed directly on the Mac, use its reachable LAN address. Docker Desktop's `host.docker.internal` also reaches the Mac from a container, but other devices may not resolve that name for the “Open Jellyfin” link.

[Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/) · [Container/host networking](https://docs.docker.com/desktop/features/networking/).

</details>

<details>
<summary><strong>Podman — Linux with systemd / Quadlet</strong></summary>

For an existing Podman installation with Quadlet support, create `/etc/containers/systemd/p-fin.container` as an administrator and edit the server addresses:

```ini
[Unit]
Description=P-Fin web client
Wants=network-online.target
After=network-online.target

[Container]
Image=docker.io/varunadityaaga/p-fin:latest
ContainerName=p-fin
PublishPort=8080:8080
Environment=JELLYFIN_URL=http://192.168.1.10:8096
Environment=SEERR_URL=
ReadOnly=true
Tmpfs=/tmp
DropCapability=all
NoNewPrivileges=true

[Service]
Restart=always
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
```

Load and start it:

```sh
sudo systemctl daemon-reload
sudo systemctl start p-fin.service
sudo systemctl status p-fin.service
```

Open the Linux host's IP at port `8080`. Quadlet generates the service; the `[Install]` section handles boot activation, so do not try to enable the generated unit as a normal service file. For an update, run `sudo podman pull docker.io/varunadityaaga/p-fin:latest`, then `sudo systemctl restart p-fin.service`.

This is a system-wide installation. Rootless Quadlet has different file locations and user-service startup requirements; use Podman's instructions if you already manage rootless containers.

[Podman: Quadlet configuration and service lifecycle](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html).

</details>

<details>
<summary><strong>TrueNAS CORE, FreeBSD / XigmaNAS, and NAS models without Docker</strong></summary>

The supplied image requires a Linux container runtime. A FreeBSD jail is not a Linux Docker host, and some WD My Cloud, NETGEAR ReadyNAS, Buffalo and older consumer NAS models do not provide a supported Docker package.

1. Check whether your specific NAS model and OS offer a supported Linux VM or container runtime; do not infer support from the brand name.
2. If Linux VMs are available, create a Debian/Ubuntu VM, give it a reachable network address, and use the **Linux / DIY servers** instructions inside it.
3. Otherwise, run P-Fin on a separate mini PC, Raspberry Pi or other Docker-capable computer on your network.
4. Set `JELLYFIN_URL` to the existing Jellyfin server's address. Your media can remain on the NAS; P-Fin does not need a file share or a copy of the library.
5. Open the IP/port of the machine running P-Fin, rather than the storage-only NAS.

This also provides a route for older Kubernetes-based TrueNAS SCALE installations without changing their existing application system. There is no need to replace the NAS operating system just to host the client elsewhere.

[Docker: supported installation platforms](https://docs.docker.com/engine/install/) · [TrueNAS CORE virtual machines](https://www.truenas.com/docs/core/coretutorials/virtualization/).

</details>

### Configuration and troubleshooting

<details>
<summary><strong>Server addresses, environment variables and networking</strong></summary>

| Variable | Default | Where to set it |
| --- | --- | --- |
| `JELLYFIN_URL` | Empty | Container environment; suggests a server and enables its same-origin Jellyfin proxy. |
| `SEERR_URL` | Empty | Container environment; suggests a Seerr server during setup. Users can also choose one in the interface. |
| `PFIN_PORT` | `8080` | `.env` or stack variables when using the repository's Compose file. |
| `PFIN_IMAGE` | `varunadityaaga/p-fin:latest` | `.env` or stack variables when using the repository's Compose file; use a published version tag to pin a release. |

`PFIN_PORT` and `PFIN_IMAGE` are Compose substitutions, not settings read by the app. In the general example, edit `ports` and `image` directly instead. Recreate/redeploy the container after environment changes; rebuilding the image is unnecessary.

Use addresses reachable **from the container**. `localhost` points to the container itself. A NAS LAN IP or domain usually works for both the proxy and the browser's “Open Jellyfin” link. Docker service names work only when the containers share a suitable Docker network; they may not resolve in a user's browser. Tailscale/VPN addresses also need a working route from the Docker host/container, not just from your laptop.

URLs can include a server base path, such as `http://nas:8096/jellyfin`. Set `JELLYFIN_URL` when you want requests proxied through P-Fin, particularly if the public P-Fin site uses HTTPS while Jellyfin uses HTTP. Without it, users can enter a server themselves, subject to the browser's CORS and mixed-content restrictions.

</details>

<details>
<summary><strong>HTTPS and reverse proxies</strong></summary>

1. First confirm that P-Fin works at its local IP and published port.
2. In your existing NAS reverse proxy, Nginx Proxy Manager, Caddy, Traefik or equivalent, route a dedicated hostname such as `watch.example.com` to `http://YOUR-DOCKER-HOST-IP:8080`.
3. If the proxy shares P-Fin's Docker network, it can instead use the service name `p-fin` and container port `8080`.
4. Enable WebSocket forwarding where the proxy requires it and configure HTTPS for the hostname.
5. Keep the entire site at `/`. A subdirectory such as `example.com/p-fin` is not supported by this deployment. Route the entire hostname to P-Fin, including `/jellyfin/` and `/seerr/`.

P-Fin's container handles the upstream service proxies. Do not add separate rewrites that strip those paths before requests reach it. If a proxy applies short timeouts or response caching to media requests, adjust those settings for streaming and test a full playback session.

</details>

<details>
<summary><strong>Installation problems, updates and recovery</strong></summary>

| Symptom | Check |
| --- | --- |
| Image cannot be pulled / repository not found | Confirm that the image/tag has been published and the registry is reachable. Until publication, use the local build below. |
| No matching manifest / exec format error | Compare the installed OS architecture with AMD64, ARM64 or ARMv7. Remove any incorrect forced `platform` value. |
| Port already in use | Change only the host side of the mapping, for example `8088:8080`. |
| Container exits with a read-only filesystem error | Restore the tmpfs mount at `/tmp` when using `read_only: true`; retain the image's default user and entrypoint. |
| Login page loads but Jellyfin cannot connect | Verify the address, protocol, port and base path from the container's network. Check that Jellyfin is running and the firewall permits the connection. |
| Seerr cannot connect | Check its URL independently; Jellyfin and Seerr may use different hosts or ports. Complete Seerr authentication in P-Fin. |
| Docker service name does not resolve | Put the services on a shared Docker network or use a reachable host address. |
| Changed settings have no effect | Recreate/redeploy with the edited environment. A plain restart retains the existing container configuration. |
| Update still shows the old app | Pull the new image, recreate the container and reload the browser. Restarting alone does not pull an image. |
| Container is healthy but a server is offline | The health check verifies P-Fin itself; it does not require Jellyfin or Seerr to be online. |

For a Compose installation, inspect status and recent logs from the project folder:

```sh
docker compose ps
docker compose logs --tail=100 p-fin
```

To roll back, set `image` to a previously published version tag, then pull and redeploy. Back up the project definition and any `.env` file. Account data remains in Jellyfin/Seerr; export or sync browser-only preferences before clearing browser storage or moving to a different hostname.

</details>

### Build locally

On an AMD64 or ARM64 Docker host, open a checkout of this repository and build the image:

```sh
docker build -t p-fin:local .
```

Copy `example.env` to `.env` beside `docker-compose.yaml`, set your server addresses, and add `PFIN_IMAGE=p-fin:local` to that file. Then start the container:

```sh
docker compose up -d --pull never
```

These commands work in a Linux/macOS terminal or PowerShell with Docker running. A locally built image is available only to that Docker engine; it does not create a downloadable image in Docker Hub. For a different host or architecture, publish the multi-platform image before using the pull-based guides.

To verify a built image, run `node --test deploy/docker.test.mjs` with Node.js 22 or newer. The tests start temporary containers and check startup, health, routing, Docker DNS, Jellyfin playback requests and Seerr authentication forwarding.

### Publish images

The [Docker publishing workflow](.github/workflows/docker-publish.yml) runs the application checks and container tests, then builds all three architectures. It runs manually from GitHub Actions or when a `v`-prefixed semantic version tag is pushed, such as `v1.0.0`. Stable releases get a version tag, a major/minor tag and `latest`; prereleases do not replace `latest`. A manual run on `main` updates `latest`.

Create the public `p-fin` repository in Docker Hub and add a write-enabled Docker Hub access token to GitHub Actions as the `DOCKERHUB_TOKEN` repository secret. The default Docker Hub username is `varunadityaaga`; set the `DOCKERHUB_USERNAME` repository variable to use another account, and adjust `PFIN_IMAGE` accordingly. Signing in to Docker Hub in a browser does not authenticate GitHub Actions.

<!-- ## Screenshots
<table>
  <tr>
    <td><img width="1720" height="720" alt="" src="..." /></td>
  </tr>
  <tr>
	  <td><img width="1720" height="720" alt="" src="..." /></td>
  </tr>
  <tr>
    <td><img width="1720" height="720" alt="" src="..." /></td>
    <td><img width="1720" height="720" alt="" src="..." /></td>
  </tr>
</table> -->

<!-- ## Downloads

<p align="center">
  <a href="https://downloadhistory.varunaditya.xyz/#varunaditya-plus/P-Fin&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://downloadhistory.varunaditya.xyz/svg?repos=varunaditya-plus/P-Fin&type=Date&title=&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://downloadhistory.varunaditya.xyz/svg?repos=varunaditya-plus/P-Fin&type=Date&title=" />
      <img alt="Download History Chart" src="https://downloadhistory.varunaditya.xyz/svg?repos=varunaditya-plus/P-Fin&type=Date&title=" width=600 />
    </picture>
  </a>
</p> -->

<!-- ## FAQ

<details><summary><b>Question</b></summary>

Answer

</details> -->


## Contributing & Support
If you have suggestions or features you'd like to be implemented into P-Fin, please open a pull request. For feature requests, suggestions, and bug reports, open an issue. Include your Jellyfin version and a screenshot if relevant.
<!-- 
See [CONTRIBUTING.md](CONTRIBUTING.md) for testing expectations, commit format, versioning, and PR guidelines.

Use [AGENTS.md](AGENTS.md) with your AI of choice to give it context on this codebase and how code should be written in PRs. -->

## Credits
...
