import type {
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
} from "n8n-workflow";
import { NodeOperationError } from "n8n-workflow";
import { getDiscordClient } from "../../src/ClientStore";
import type { ClientEvents } from "discord.js-selfbot-v13";
import { camelCaseToTitleCase } from "../../src/camelCaseToTitleCase";

const events: (keyof ClientEvents)[] = [
	"applicationCommandPermissionsUpdate",
	"channelCreate",
	"channelDelete",
	"channelPinsUpdate",
	"channelUpdate",
	"emojiCreate",
	"emojiDelete",
	"emojiUpdate",
	"guildAvailable",
	"guildBanAdd",
	"guildBanRemove",
	"guildCreate",
	"guildDelete",
	"guildUnavailable",
	"guildIntegrationsUpdate",
	"guildMemberAdd",
	"guildMemberAvailable",
	"guildMemberRemove",
	"guildMembersChunk",
	"guildMemberUpdate",
	"guildUpdate",
	"inviteCreate",
	"inviteDelete",
	"messageCreate",
	"messageDelete",
	"messageReactionRemoveAll",
	"messageReactionRemoveEmoji",
	"messageDeleteBulk",
	"messageReactionAdd",
	"messageReactionRemove",
	"messageUpdate",
	"presenceUpdate",
	"roleCreate",
	"roleDelete",
	"roleUpdate",
	"threadCreate",
	"threadDelete",
	"threadListSync",
	"threadMemberUpdate",
	"threadMembersUpdate",
	"threadUpdate",
	"typingStart",
	"userUpdate",
	"voiceChannelEffectSend",
	"voiceStateUpdate",
	"webhookUpdate",
	"stageInstanceCreate",
	"stageInstanceUpdate",
	"stageInstanceDelete",
	"stickerCreate",
	"stickerDelete",
	"stickerUpdate",
	"guildScheduledEventCreate",
	"guildScheduledEventUpdate",
	"guildScheduledEventDelete",
	"guildScheduledEventUserAdd",
	"guildScheduledEventUserRemove",
	"guildAuditLogEntryCreate",
	"relationshipAdd",
	"relationshipRemove",
	"relationshipUpdate",
	"channelRecipientAdd",
	"channelRecipientRemove",
	"interactionModalCreate",
	"callCreate",
	"callUpdate",
	"callDelete",
	"messagePollVoteAdd",
	"messagePollVoteRemove",
];

export class DiscordTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: "Discord Trigger",
		name: "discordTrigger",
		group: ["trigger"],
		version: 1,
		description:
			"Triggers every time the client receives a specified type of event",
		defaults: {
			name: "Discord Trigger",
		},
		inputs: [],
		outputs: ["main"],
		icon: "file:discord.svg",

		credentials: [{
			name: "discordUserApi",
			required: true,
		}],
		properties: [
			{
				displayName: "Event",
				name: "event",
				type: "options",
				default: "",
				noDataExpression: true,
				required: true,
				options: events.map((event) => ({
					name: camelCaseToTitleCase(event),
					value: event,
				})),
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const { token } = await this.getCredentials<{ token: string }>(
			"discordUserApi",
		);

		try {
			const event = this.getNodeParameter("event") as keyof ClientEvents;
			const client = await getDiscordClient(token);

			const onMsg = (...args: unknown[]) => {
				const json = JSON.parse(JSON.stringify(args))
				this.emit([this.helpers.returnJsonArray(
					args.length === 1 ? json : [json]
				)]);
			};

			client.on(event, onMsg);

			return {
				closeFunction: async () => void client.off(event, onMsg),
			};
		} catch (error) {
			throw new NodeOperationError(this.getNode(), error, {
				description: "Failed to connect to Discord",
			});
		}
	}
}
