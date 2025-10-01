import { Client } from "discord.js-selfbot-v13";

const clients = new Map<string, Client>();

export const getDiscordClient = async (token: string): Promise<Client> => {
	{
		const client = clients.get(token);
		if (client) return client;
	}

	const client = new Client();
	await client.login(token);

	const removeClient = () => void clients.delete(token);
	client.once("shardDisconnect", removeClient);
	client.once("invalidated", removeClient);

	clients.set(token, client);
	return client;
};
