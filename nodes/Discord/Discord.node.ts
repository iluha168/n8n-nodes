import {
	NodeOperationError,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { asSnowflake, asString } from '../../src/validate';
import { getDiscordClient } from '../../src/ClientStore';
import type { MessageOptions } from 'discord.js-selfbot-v13';

export class Discord implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Discord',
		name: 'discord',
		group: ['output'],
		version: 1,
		description: 'Fetch from and send data to Discord',
		defaults: {
			name: 'Discord',
		},
		inputs: ['main'],
		outputs: ['main'],
		icon: 'file:discord.svg',

		credentials: [
			{
				name: 'discordUserApi',
				required: true,
			},
		],

		subtitle: '={{ $parameter.resource + ": " + $parameter.operation }}',

		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				default: 'channel',
				noDataExpression: true,
				required: true,
				options: [
					{
						name: 'Channel',
						value: 'channel',
					},
					{
						name: 'Message',
						value: 'message',
					},
					{
						name: 'User',
						value: 'user',
					},
				],
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'send_message',
				noDataExpression: true,
				required: true,
				options: [
					{
						name: 'Send Message',
						value: 'send_message',
						action: 'Send message',
					},
					{
						name: 'Get Channel Information',
						value: 'fetch_channel',
						action: 'Get channel information',
					},
				],
				displayOptions: {
					show: {
						resource: ['channel'],
					},
				},
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'react',
				noDataExpression: true,
				required: true,
				options: [
					{
						name: 'React to a Message',
						value: 'react',
						action: 'React to a message',
					},
				],
				displayOptions: {
					show: {
						resource: ['message'],
					},
				},
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'fetch_user',
				noDataExpression: true,
				required: true,
				options: [
					{
						name: 'Get User Information',
						value: 'fetch_user',
						action: 'Get user information',
					},
				],
				displayOptions: {
					show: {
						resource: ['user'],
					},
				},
			},
			{
				displayName: 'Channel ID',
				name: 'channelId',
				type: 'string',
				default: '',
				placeholder: '1234567890',
				displayOptions: {
					show: {
						operation: ['send_message', 'react', 'fetch_channel'],
					},
				},
			},
			{
				displayName: 'Message ID',
				name: 'messageId',
				type: 'string',
				default: '',
				placeholder: '1234567890',
				displayOptions: {
					show: {
						operation: ['react'],
					},
				},
			},
			{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
				placeholder: '1234567890',
				displayOptions: {
					show: {
						operation: ['fetch_user'],
					},
				},
			},
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				default: '',
				placeholder: 'I hope this message finds you well.',
				displayOptions: {
					show: {
						operation: ['send_message'],
					},
				},
			},
			{
				displayName: 'Reactions',
				name: 'reactions',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: [],
				placeholder: 'Add Reaction',
				displayOptions: {
					show: {
						operation: ['react'],
					},
				},
				options: [
					{
						displayName: 'Values',
						name: 'values',
						values: [
							{
								displayName: 'Reaction',
								name: 'reaction',
								type: 'string',
								default: '',
								required: true,
							},
						],
					},
				],
				required: true,
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				default: {},
				placeholder: 'Add Field',
				displayOptions: {
					show: {
						operation: ['react'],
					},
				},
				options: [
					{
						displayName: 'Super React',
						name: 'reactions_burst',
						type: 'boolean',
						default: false,
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const { token } = await this.getCredentials<{ token: string }>('discordUserApi');
		const client = await getDiscordClient(token).catch((e) => {
			throw new NodeOperationError(this.getNode(), e, {
				description: 'Failed to connect to Discord',
			});
		});

		const returnData: INodeExecutionData[] = [];
		for (const itemIndex of this.getInputData().keys()) {
			const getGetParam =
				<O>(name: string, validate: (param: unknown) => O, fallback?: O) =>
				() => {
					try {
						return validate(this.getNodeParameter(name, itemIndex, fallback));
					} catch (e) {
						throw new NodeOperationError(
							this.getNode(),
							new Error(`Parameter "${name}" failed validation`, { cause: e }),
							{ itemIndex },
						);
					}
				};

			const operation = getGetParam('operation', asString)();
			const getChannelId = getGetParam('channelId', asSnowflake);
			const getMessageId = getGetParam('messageId', asSnowflake);
			const getUserId = getGetParam('userId', asSnowflake);
			const getContent = getGetParam('content', asString);

			switch (operation) {
				case 'send_message':
					{
						const payload = { content: getContent() } satisfies MessageOptions;
						await client.channels
							.fetch(getChannelId())
							.then((channel) =>
								channel?.isText() ? channel.send(payload) : Promise.reject('Not a text channel'),
							)
							.then((msg) =>
								returnData.push({
									json: msg.toJSON() as any,
									pairedItem: itemIndex,
								}),
							)
							.catch((error) => {
								if (this.continueOnFail()) {
									returnData.push({ json: payload, error, pairedItem: itemIndex });
									return;
								}
								throw new NodeOperationError(this.getNode(), error, {
									description: 'Failed to send message',
								});
							});
					}
					break;
				case 'react':
					{
						const { values: reactions } = this.getNodeParameter('reactions', itemIndex) as {
							values: { reaction: string }[];
						};
						try {
							const isBurst = !!(
								this.getNodeParameter('additionalFields', itemIndex) as {
									reactions_burst?: boolean;
								}
							).reactions_burst;

							const channel = await client.channels.fetch(getChannelId());
							if (!channel?.isText()) throw 'Not a text channel';

							const message = await channel.messages.fetch(getMessageId());
							for (const { reaction } of reactions) {
								const res = await message.react(reaction, isBurst);
								returnData.push({
									json: {
										count: res.count,
										emoji: res.emoji.toString(),
										super: {
											colors: res.burstColors,
											count: res.countDetails.burst,
											hasMe: res.meBurst,
										},
										normal: {
											count: res.countDetails.normal,
											hasMe: res.me,
										},
									},
									pairedItem: itemIndex,
								});
							}
						} catch (error) {
							if (this.continueOnFail()) {
								returnData.push({ json: { emojis: reactions }, error, pairedItem: itemIndex });
							} else {
								throw new NodeOperationError(this.getNode(), error, {
									description: 'Failed to add reactions',
								});
							}
						}
					}
					break;
				case 'fetch_channel':
					{
						const channelId = getChannelId();
						try {
							const channel = await client.channels.fetch(channelId);
							if (!channel) throw 'Channel is null';

							returnData.push({ json: channel.toJSON() as any, pairedItem: itemIndex });
						} catch (error) {
							if (this.continueOnFail()) {
								returnData.push({ json: { channelId }, error, pairedItem: itemIndex });
							} else {
								throw new NodeOperationError(this.getNode(), error, {
									description: 'Failed to fetch channel',
								});
							}
						}
					}
					break;
				case 'fetch_user':
					{
						const userId = getUserId();
						try {
							const user = await client.users.fetch(userId);

							returnData.push({ json: user.toJSON() as any, pairedItem: itemIndex });
						} catch (error) {
							if (this.continueOnFail()) {
								returnData.push({ json: { userId }, error, pairedItem: itemIndex });
							} else {
								throw new NodeOperationError(this.getNode(), error, {
									description: 'Failed to fetch user',
								});
							}
						}
					}
					break;
				default:
					throw new NodeOperationError(this.getNode(), 'Unknown action type: ' + operation, {
						itemIndex,
					});
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}
