
export const ENTITY_TYPE = "slack#/entities/item";
export const EMBED_MIME_TYPE = "application/vnd.slack-embed";
export const EXTERNAL_REF_TYPE = "doom_launch";

export interface EntityPayload {
  attributes: {
    title: { text: string };
    product_name: string;
    metadata_last_modified?: number;
    full_size_preview: {
      is_supported: true;
      mime_type: typeof EMBED_MIME_TYPE;
      preview_url?: string;
    };
  };
  fields: Record<string, unknown>;
}

export interface Entity {
	url: string;
	external_ref: {id: string; type: string };
	entity_type: string;
	enetity_payload: EntityPayload;
}

export function buildCardEntity(
  launchId: string,
  publicBaseUrl: string,
): Entity {
  return {
    url: `${publicBaseUrl}/doom/${launchId}`,
    external_ref: { id: launchId, type: EXTERNAL_REF_TYPE },
    entity_type: ENTITY_TYPE,
    entity_payload: {
      attributes: {
        title: { text: "DOOM" },
        product_name: "SLOOM",
        full_size_preview: {
          is_supported: true,
          mime_type: EMBED_MIME_TYPE,
        },
      },
      fields: {},
    },
  };
}

export function buildDetailsEntity(
  launchId: string,
  entityUrl: string,
  publicBaseUrl: string,
): Entity {
  return {
    url: entityUrl,
    external_ref: { id: launchId, type: EXTERNAL_REF_TYPE },
    entity_type: ENTITY_TYPE,
    entity_payload: {
      attributes: {
        title: { text: "DOOM" },
        product_name: "SLOOM",
        metadata_last_modified: Math.floor(Date.now() / 1000),
        full_size_preview: {
          is_supported: true,
          mime_type: EMBED_MIME_TYPE,
          preview_url: `${publicBaseUrl}/embed/doom?launch=${encodeURIComponent(launchId)}`,
        },
      },
      fields: {},
    },
  };
}

export function buildPostMessageArgs(
	channel: string,
	launchId: string,
	publicBaseUrl: string,
): {
	channel: string;
	text: string;
  metadata : { entities: Entity};
} {
  return {
    channel,
    text: "SLOOM - Slack + DOOM"
    metadata: { entities: [buildCardEntity(launchId, publicBaseUrl)] },
  };
}
