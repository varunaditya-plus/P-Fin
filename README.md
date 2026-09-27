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

P-Fin runs as one Docker container. It needs an existing Jellyfin server; Seerr is optional. No media folders, database, GPU access or persistent container volume are needed. Playback progress is stored in Jellyfin, and preferences are stored in the browser or synced to the Jellyfin account.

### Docker Compose

The publishing workflow targets `varunadityaaga/p-fin` for Intel/AMD (`amd64`), ARM64 and ARMv7 NAS devices. The image must be published once before the pull-based instructions below will work. Until then, use the local build instructions below.

1. Download [docker-compose.yaml](docker-compose.yaml) and [example.env](example.env) into a folder on your NAS. Rename `example.env` to `.env`.
2. Set `JELLYFIN_URL` to your Jellyfin address, for example `http://192.168.1.10:8096`. Optionally set `SEERR_URL` to `http://192.168.1.10:5055`.
3. Start the stack:

```sh
docker compose up -d
```

Open `http://YOUR-NAS-IP:8080`, select your server and sign in. Each user can enable or skip Seerr during setup.

In [Synology Container Manager](https://kb.synology.com/en-global/DSM/help/ContainerManager/docker_project), import the Compose file as a Project. In [Portainer](https://docs.portainer.io/user/docker/stacks/add), paste it into a Stack and set the environment variables. In a NAS container UI such as QNAP Container Station or Unraid, use the same image, map host port `8080` to container port `8080`, and add the server URL variables. The NAS must support Docker and one of the listed CPU architectures.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `JELLYFIN_URL` | Empty | Suggested Jellyfin server and the container's Jellyfin proxy target. |
| `SEERR_URL` | Empty | Suggested Seerr server. Users can also choose Seerr in the interface. |
| `PFIN_PORT` | `8080` | Published host port when using Compose. |
| `PFIN_IMAGE` | `varunadityaaga/p-fin:latest` | Image/tag used by Compose; set a version tag to pin a release. |

Settings are read when the container starts; changing server URLs does not require rebuilding the image. With no server URLs configured, the client starts at the server selection screen. Set `JELLYFIN_URL` when the site needs to proxy Jellyfin over the same origin, especially when P-Fin uses HTTPS and Jellyfin uses HTTP.

Use addresses reachable from the container. `localhost` means the P-Fin container, not your NAS. A NAS IP/domain reachable by both the container and your browser also makes the “Open Jellyfin” link work. Docker service names work when the services share a Docker network. URLs may include a server base path. Do not put passwords or API keys in these variables; sign in through the interface.

For HTTPS, point your NAS reverse proxy at port `8080` and enable WebSocket forwarding. Serve P-Fin at the root of its own hostname, such as `https://watch.example.com`, rather than under a URL subdirectory. The container already proxies Jellyfin and Seerr API requests and supports playback ranges and WebSockets.

Update an installed image with:

```sh
docker compose pull
docker compose up -d
```

### Build locally

From a checkout of this repository:

```sh
docker build -t p-fin:local .
PFIN_IMAGE=p-fin:local docker compose up -d --pull never
```

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
