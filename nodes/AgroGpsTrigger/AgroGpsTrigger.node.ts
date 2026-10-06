import {
	NodeApiError,
	NodeConnectionTypes,
	type IDataObject,
	type IHookFunctions,
	type IHttpRequestOptions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
	type JsonObject,
} from 'n8n-workflow';
import { headerValue, rawBodyOf, verifySignature, wantsEvent } from './signature';
import {
	createWebhook,
	deleteWebhook,
	webhookExists,
	type RegistryResponse,
	type RegistryTransport,
	type StoredWebhook,
} from './webhook-registry';

const CREDENTIAL_NAME = 'agroGpsApi';
const DEFAULT_MAX_AGE_SECONDS = 300;
const HTTP_UNAUTHORIZED = 401;
const DEFAULT_EVENTS = ['entry.pushed', 'entry.reviewed'];

function registryTransport(context: IHookFunctions): RegistryTransport {
	return async (options: IHttpRequestOptions) =>
		(await context.helpers.httpRequestWithAuthentication.call(
			context,
			CREDENTIAL_NAME,
			options,
		)) as RegistryResponse;
}

function selectedEvents(context: IHookFunctions | IWebhookFunctions): string[] {
	const events = context.getNodeParameter('events', DEFAULT_EVENTS) as string[];
	return events.length > 0 ? events : DEFAULT_EVENTS;
}

function stored(context: IHookFunctions | IWebhookFunctions): StoredWebhook & IDataObject {
	return context.getWorkflowStaticData('node') as StoredWebhook & IDataObject;
}

function asNodeError(context: IHookFunctions, error: unknown): NodeApiError {
	return new NodeApiError(context.getNode(), { message: (error as Error).message } as JsonObject);
}

export class AgroGpsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Agro GPS Trigger',
		name: 'agroGpsTrigger',
		icon: { light: 'file:../../icons/agro-gps.svg', dark: 'file:../../icons/agro-gps.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when the Agro GPS farm diary sends a signed webhook',
		defaults: {
			name: 'Agro GPS Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: CREDENTIAL_NAME,
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					'Needs a write API key. Activating the workflow registers the webhook in Agro GPS; deactivating it removes it. Agro GPS only delivers to public https URLs.',
				name: 'setupNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: [
					{
						name: 'Operation Registered',
						value: 'entry.pushed',
						description: 'New or changed operations reached the farm diary',
					},
					{
						name: 'Operation Reviewed',
						value: 'entry.reviewed',
						description: 'An advisor reviewed an operation',
					},
				],
				default: ['entry.pushed', 'entry.reviewed'],
				description: 'Which events start the workflow',
			},
			{
				displayName: 'Max Age (Seconds)',
				name: 'maxAgeSeconds',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: DEFAULT_MAX_AGE_SECONDS,
				description: 'Reject deliveries whose timestamp is older than this. 0 disables the check.',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = stored(this);
				try {
					const exists = await webhookExists(
						registryTransport(this),
						data,
						this.getNodeWebhookUrl('default') as string,
					);
					if (!exists) {
						delete data.webhookId;
						delete data.secret;
					}
					return exists;
				} catch (error) {
					throw asNodeError(this, error);
				}
			},
			async create(this: IHookFunctions): Promise<boolean> {
				try {
					const created = await createWebhook(
						registryTransport(this),
						this.getNodeWebhookUrl('default') as string,
						selectedEvents(this),
					);
					Object.assign(stored(this), created);
					return true;
				} catch (error) {
					throw asNodeError(this, error);
				}
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const data = stored(this);
				try {
					await deleteWebhook(registryTransport(this), data);
				} catch (error) {
					throw asNodeError(this, error);
				}
				delete data.webhookId;
				delete data.secret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const body = this.getBodyData() as IDataObject;
		const verdict = verifySignature(
			String(stored(this).secret ?? ''),
			headerValue(request.headers['x-agro-timestamp']),
			headerValue(request.headers['x-agro-signature']),
			rawBodyOf((request as { rawBody?: unknown }).rawBody, body),
			Math.floor(Date.now() / 1000),
			Number(this.getNodeParameter('maxAgeSeconds', DEFAULT_MAX_AGE_SECONDS)),
		);
		if (verdict !== 'valid') {
			const response = this.getResponseObject();
			response.status(HTTP_UNAUTHORIZED).json({ error: `Invalid Agro GPS signature (${verdict})` });
			return { noWebhookResponse: true };
		}
		const event = headerValue(request.headers['x-agro-event']) || String(body.event ?? '');
		if (!wantsEvent(selectedEvents(this), event)) {
			return { webhookResponse: { ignored: event } };
		}
		return {
			workflowData: [this.helpers.returnJsonArray([{ ...body, event }])],
		};
	}
}
