<div align="center">

<div alt style="text-align: center; transform: scale(.25);">
	<picture>
		<source media="(prefers-color-scheme: dark)" srcset="https://github.com/varunaditya-plus/P-Fin/raw/main/assets/logo_dark.png" />
		<img alt="P-Fin Logo" src="https://github.com/varunaditya-plus/P-Fin/raw/main/assets/logo_light.png" style="width: 170px;" />
	</picture>
</div>

# P-Fin
[![MIT License](https://shieldcn.dev/badge/license-MIT.svg?variant=outline&size=sm)](LICENSE.md)
[![Docker Pulls](https://shieldcn.dev/docker/pulls/varunadityaaga/p-fin.svg?variant=outline&size=sm)](https://hub.docker.com/r/varunadityaaga/p-fin)
[![Docker Version](https://shieldcn.dev/docker/v/varunadityaaga/p-fin.svg?size=sm)](https://hub.docker.com/r/varunadityaaga/p-fin/tags)
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

P-Fin runs in a container alongside an existing Jellyfin server with optional Seerr integration. It needs Docker but no media mounts, database, GPU access or persistent volume. The images P-Fin currently supports are AMD64, ARM64 and ARMv7.

### General guide

1. Install your NAS's container manager or [Docker with Compose](https://docs.docker.com/engine/install/).
2. Create a project using the YAML below. Set `JELLYFIN_URL` to your server address, and `SEERR_URL` (optional). Make sure the addresses are reachable from the container, not `localhost`.
3. Deploy through your container manager, or save the file as `compose.yaml` and run `docker compose up -d` from its folder.
4. Open `http://SERVERIP:8080`, choose **Use configured server**, sign in to Jellyfin, then enable Seerr or skip it.

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

If port `8080` is occupied, use `"8088:8080"` and open port `8088`. Keep the container port at `8080`. Do not enter your credentials through the YAML. Enter them in P-Fin.

Alternatively, download `docker-compose.yaml` and `example.env`, rename the `example.env` to `.env`, and edit the settings there. To update, pull the image and redeploy through your manager, or run:

```sh
docker compose pull
docker compose up -d
```

Below are some guides for different types of devices/platforms. They use the same configuration. In container forms, leave the image's user, command and entrypoint unchanged. If enabling read-only mode, keep the writable `/tmp` tmpfs mount.

<details>
<summary><strong>NAS platforms</strong></summary>

<details>
<summary><strong>Synology (via Container Manager)</strong></summary>

1. Install **Container Manager** from Package Center and create a folder such as `docker/p-fin`.
2. Open **Project → Create**, name it `p-fin` and select that folder.
3. Paste or upload the Compose example, edit the addresses and start the project.
4. Open `http://YOUR-SYNOLOGY-IP:8080`.

[Synology documentation](https://kb.synology.com/en-global/DSM/help/ContainerManager/docker_project).

</details>

<details>
<summary><strong>QNAP (via Container Station)</strong></summary>

1. Install **Container Station** from App Center.
2. Open **Applications → Create**, name it `p-fin` and paste the Compose example.
3. Set the addresses and host port. QNAP may already use `8080`; use `"8088:8080"` if needed.
4. Validate, create and open `http://YOUR-QNAP-IP:8088` if you chose that port.

[QNAP documentation](https://www.qnap.com/en/how-to/tutorial/article/how-to-use-container-station-3).

</details>

<details>
<summary><strong>UGREEN (via UGOS Pro)</strong></summary>

1. Install **Docker** from App Center and open **Project → Create**.
2. Name the project `p-fin`, choose a folder and import the Compose example with your server addresses filled in.
3. Deploy and open `http://YOUR-UGREEN-IP:8080`.

[UGREEN documentation](https://support.ugnas.com/detail/article/en-US/507).

</details>

<details>
<summary><strong>ASUSTOR (via ADM)</strong></summary>

1. Install **Portainer CE** from App Central; Docker Engine is installed as a dependency if needed.
2. Open Portainer and complete its initial setup.
3. Select the local environment, then **Stacks → Add stack**. Paste the Compose example, edit the addresses and deploy.
4. Open `http://YOUR-ASUSTOR-IP:8080`.

[ASUSTOR documentation](https://www.asustor.com/online/College_topic?topic=145).

</details>

<details>
<summary><strong>TerraMaster (via TOS)</strong></summary>

1. Install **Docker Engine** and **Container Manager** from the application centre.
2. Open **Projects → Add**, name it `p-fin` and choose a project folder.
3. Import the Compose example, edit the addresses, validate and apply it.
4. Start the project and open `http://YOUR-TNAS-IP:8080`.

[TerraMaster documentation](https://help.terra-master.com/docs/TOS7/application/container-manager).

</details>

<details>
<summary><strong>Unraid</strong></summary>

1. Enable Docker in **Settings → Docker**, then choose **Docker → Add Container**.
2. Set the name to `p-fin`, repository to `varunadityaaga/p-fin:latest` and network to **bridge**.
3. Map a free host port to container port `8080` (TCP). Add `JELLYFIN_URL` and optional `SEERR_URL` variables. No paths or devices are required.
4. Apply, enable **Autostart**, and open the Unraid IP at your chosen port. Use **Check for Updates / Update** for later releases.

[Unraid documentation](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/).

</details>

<details>
<summary><strong>TrueNAS (Docker-based Apps), 24.10 and later</strong></summary>

1. Configure the **Apps** storage pool if needed, then open **Apps → Discover Apps**.
2. In the three-dot menu beside the custom-app controls, select **Install via YAML**.
3. Name the app `pfin`, paste the Compose example with your server addresses and save.
4. Open `http://YOUR-TRUENAS-IP:8080`. Manage updates through TrueNAS Apps.

[TrueNAS documentation](https://apps.truenas.com/managing-apps/installing-custom-apps/).

</details>

<details>
<summary><strong>OpenMediaVault</strong></summary>

1. Install **openmediavault-compose** through OMV-Extras for your OMV version.
2. Under **Services → Compose → Settings**, select a folder for Compose files.
3. Open **Files**, add `p-fin`, paste the Compose example and edit the addresses. Save and select **Up**.
4. Open `http://YOUR-OMV-IP:8080`. To update, select **Pull**, then **Up**.

[OMV 8 documentation](https://wiki.omv-extras.org/doku.php?id=omv8:omv8_plugins:docker_compose) · [OMV 7 documentation](https://wiki.omv-extras.org/doku.php?id=omv7:omv7_plugins:docker_compose).

</details>

</details>

<details>
<summary><strong>Container managers and home-server dashboards</strong></summary>

<details>
<summary><strong>Portainer</strong></summary>

1. Select your Docker **Standalone** environment and open **Stacks → Add stack → Web editor**.
2. Name it `p-fin`, paste the Compose example and edit the addresses. If using the repository's variable-based file, load `.env` through Portainer's **Environment variables** section.
3. Deploy and open the Docker host's IP at the published port.
4. To update, use **Update the stack** with the image re-pull option enabled.

[Portainer documentation](https://docs.portainer.io/user/docker/stacks/add).

</details>

<details>
<summary><strong>Dockge</strong></summary>

1. Select the Docker host and use **+ Compose** to create `p-fin`.
2. Paste the Compose example, edit the addresses and deploy.
3. Open the Docker host's IP at the published port. Use the stack's image-update controls for updates.

For file imports, place `compose.yaml` and any `.env` in `<stacks directory>/p-fin/`, then scan for stacks. The default directory is `/opt/stacks`.

[Dockge documentation](https://github.com/louislam/dockge).

</details>

<details>
<summary><strong>CasaOS</strong></summary>

1. Choose **+ → Install a customized app → Import → Docker Compose**.
2. Paste the example with your server addresses. Name the app `P-Fin` and set its web shortcut to HTTP, your published port and path `/`.
3. Install and open `http://YOUR-CASAOS-IP:8080`.

Keep the `/tmp` tmpfs mount with read-only mode. If the importer cannot preserve these settings, use Portainer or Dockge.

[CasaOS documentation](https://wiki.casaos.io/en/apps).

</details>

<details>
<summary><strong>ZimaOS</strong></summary>

1. Choose **Install a Customized App → Import → Docker Compose**.
2. Paste the example with your server addresses and name the app `P-Fin`. Set its web shortcut to HTTP, the published port and path `/`.
3. Preserve the `/tmp` tmpfs mount, install and open `http://YOUR-ZIMAOS-IP:8080`.

[ZimaOS documentation](https://www.zimaspace.com/docs/zimaos/casaos-to-zimaos-migration).

</details>

</details>

<details>
<summary><strong>Computers, virtual machines and other setups</strong></summary>

<details>
<summary><strong>Linux servers and mini PCs</strong></summary>

1. Install Docker Engine and Compose for your distribution, such as Ubuntu or Debian.
2. Save the general example as `compose.yaml`, edit the addresses and run `docker compose up -d` from its folder.
3. Open `http://SERVERIP:8080` and ensure Docker starts at boot.

[Docker Engine installation](https://docs.docker.com/engine/install/) · [Compose installation](https://docs.docker.com/compose/install/linux/).

</details>

<details>
<summary><strong>Proxmox VE</strong></summary>

1. Create a Debian/Ubuntu VM connected to your LAN bridge, usually `vmbr0`.
2. Install Docker and Compose inside the VM, then follow the general guide there.
3. Enable **Start at boot** for the VM and open `http://YOUR-VM-IP:8080`.

Use the VM's IP, not the Proxmox management IP. No media or GPU passthrough is needed.

[Proxmox documentation](https://pve.proxmox.com/pve-docs/chapter-pct.html).

</details>

<details>
<summary><strong>Windows</strong></summary>

1. Install and start **Docker Desktop** with Linux containers, using a supported backend such as WSL 2.
2. Save the general Compose example and run its commands from PowerShell or a Docker-enabled WSL terminal.
3. Open `http://localhost:8080` locally, or the PC's LAN IP from another device. Allow the published port through the private-network firewall if needed.

Keep Docker Desktop running. If Jellyfin runs on this PC, use its reachable LAN address in `JELLYFIN_URL`. This container hosts P-Fin, not Jellyfin Server.

[Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/).

</details>

<details>
<summary><strong>macOS</strong></summary>

1. Install and start **Docker Desktop** for Intel or Apple silicon.
2. Save the general Compose example and run its commands from Terminal.
3. Open `http://localhost:8080` locally, or the Mac's LAN IP from another device.

Keep Docker Desktop running and the Mac awake. For Jellyfin on the same Mac, use its reachable LAN address. This container hosts P-Fin, not Jellyfin Server.

[Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/).

</details>

</details>

### Build locally

From a checkout on an AMD64 or ARM64 Docker host:

```sh
docker build -t p-fin:local .
```

Copy `example.env` to `.env`, set your server addresses and add `PFIN_IMAGE=p-fin:local`. Then run:

```sh
docker compose up -d --pull never
```

The image stays local to that Docker engine. To run the container tests, use `node --test deploy/docker.test.mjs` with Node.js 22 or newer.

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
