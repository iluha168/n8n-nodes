import {
	NodeOperationError,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from "n8n-workflow";
import { asBoolean, asSnowflake, asString } from "../../src/validate";
import { getDiscordClient } from "../../src/ClientStore";
import type { MessageOptions } from "discord.js-selfbot-v13";

type Action = "send_message" | "react"

export class Discord implements INodeType {
	description: INodeTypeDescription = {
		displayName: "Discord",
		name: "discord",
		group: ["output"],
		version: 1,
		description: "Fetch from and send data to Discord",
		defaults: {
			name: "Discord",
		},
		inputs: ["main"],
		outputs: ["main"],
		icon: "file:discord.svg",

		credentials: [{
			name: "discordUserApi",
			required: true,
		}],

		subtitle: '={{ $parameter["options"] }}',
		properties: [
			{
				displayName: "Action",
				name: "action",
				type: "options",
				default: '',
				noDataExpression: true,
				required: true,
				options: Object
					.entries({
						send_message: 'Send Message',
						react: 'React to a Message'
					} satisfies Record<Action, string>)
					.map(([value, name]) => ({ name, value })),
			},
			{
				displayName: "Channel ID",
				name: "channelId",
				type: "string",
				default: '',
				placeholder: "1234567890",
				displayOptions: {
					show: {
						"action": ["send_message", "react"] satisfies Action[],
					},
				},
			},
			{
				displayName: "Message ID",
				name: "messageId",
				type: "string",
				default: '',
				placeholder: "1234567890",
				displayOptions: {
					show: {
						"action": ["react"] satisfies Action[],
					},
				},
			},
			{
				displayName: "Content",
				name: "content",
				type: "string",
				default: '',
				placeholder: "I hope this message finds you well.",
				displayOptions: {
					show: {
						"action": ["send_message"] satisfies Action[],
					},
				},
			},
			{
				displayName: "Reactions",
				name: "reactions",
				type: "string",
				default: '',
				placeholder: "🐠👍",
				displayOptions: {
					show: {
						"action": ["react"] satisfies Action[],
					},
				},
			},
			{
				displayName: "Super React",
				name: "reactions_burst",
				type: "boolean",
				default: false,
				displayOptions: {
					show: {
						"action": ["react"] satisfies Action[],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const { token } = await this.getCredentials<{ token: string }>(
			"discordUserApi",
		);
		const client = await getDiscordClient(token)
			.catch(e => {
				throw new NodeOperationError(this.getNode(), e, {
					description: "Failed to connect to Discord",
				})
			})

		const returnData: INodeExecutionData[] = []
		for (const itemIndex of this.getInputData().keys()) {
			const getGetParam = <O>(name: string, validate: (param: unknown) => O) => () => {
				try {
					return validate(this.getNodeParameter(name, itemIndex))
				} catch(e) {
					throw new NodeOperationError(this.getNode(), new Error(
		`Parameter "${name}" failed validation`,
						{ cause: e },
					), { itemIndex })
				}
			}

			const action = getGetParam("action", asString)() as Action
			const getChannelId = getGetParam("channelId", asSnowflake)
			const getMessageId = getGetParam("messageId", asSnowflake)
			const getContent = getGetParam("content", asString)

			switch (action) {
				case "send_message": {
					const payload = { content: getContent() } satisfies MessageOptions
					await client.channels.fetch(getChannelId())
						.then(channel => channel?.isText()
							? channel.send(payload)
							: Promise.reject("Not a text channel")
						)
						.then(msg => returnData.push({
							json: msg.toJSON() as any,
							pairedItem: itemIndex,
						}))
						.catch(error => {
							if (this.continueOnFail()) {
								returnData.push({ json: payload, error, pairedItem: itemIndex })
								return
							}
							throw new NodeOperationError(this.getNode(), error, {
								description: "Failed to send message",
							})
						})
				} break
				case "react": {
					const emojis = Array.from(new Intl.Segmenter().segment(
						getGetParam("reactions", asString)()
					), s => s.segment)
					try {
						const isBurst = getGetParam("reactions_burst", asBoolean)()

						const channel = await client.channels.fetch(getChannelId())
						if (!channel?.isText()) throw "Not a text channel"

						const message = await channel.messages.fetch(getMessageId())
						for (const emoji of emojis) {
							const reaction = await message.react(emoji, isBurst)
							returnData.push({
								json: {
									count: reaction.count,
									emoji: reaction.emoji.toString(),
									super: {
										colors: reaction.burstColors,
										count: reaction.countDetails.burst,
										hasMe: reaction.meBurst,
									},
									normal: {
										count: reaction.countDetails.normal,
										hasMe: reaction.me,
									},
								},
								pairedItem: itemIndex,
							})
						}
					} catch(error) {
							if (this.continueOnFail()) {
								returnData.push({ json: { emojis }, error, pairedItem: itemIndex })
							} else {
								throw new NodeOperationError(this.getNode(), error, {
									description: "Failed to add reactions",
								})
							}
					}
				} break
				default:
					action satisfies never
					throw new NodeOperationError(this.getNode(), "Unknown action type: " + action, { itemIndex })
			}
		}

		return [this.helpers.returnJsonArray(returnData)]
	}
}
