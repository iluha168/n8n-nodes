# n8n-nodes-pelican

This is an n8n community node. It lets you use Pelican in your n8n workflows.

> [Pelican](https://pelican.dev/) is the ultimate, free game server control panel offering high flying security. It's a breeze to manage your servers with our sleek and user-friendly interface. And thanks to Docker, they all run in their own safe space.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations
- ### Server triggers:
	- ⚡🧑‍💻 On new console message
	- ⚡🔋 On power status change
	- ⚡💽 Stats update: network, RAM, disk usage, uptime
- ### User:
  - 👤 Get own profile
  - 🧑‍💻 Send a command to server console
  - 🔌 Control power state of the server
  - 🔋 Wait for specific power states of a server
  - 💽 Fetch statistics of a server
- ### Administration:
	- 👥 Get users list
	- 🧮 Get servers list

## Credentials

You would need an API key from Pelican, created by visiting your profile page in the panel.

Authentication via cookies (the same way the panel does) is also possible, though not recommended.

## Compatibility

Tested on

- n8n version 2.15.1
- Pelican Panel v1.0.0-beta33
- Pelican Wings v1.0.0-beta24

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Pelican documentation](https://pelican.dev/docs)
