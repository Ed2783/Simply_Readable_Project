// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export enum Feature {
	PREFIX = "readable",
}

export enum JobTable {
	PK = "id",
	SK = "itemId",
	SK_METADATA = "metadata",
	SK_DOCIMPORT = "documentImport",
	STATUS_KEY = "status",
	GSI_OWNER = "byOwnerAndUpdatedAt",
	GSI_OWNER_PK = "owner",
	GSI_OWNER_SK = "updatedAt",
	GSI_OWNER_ATTR_NAME = "name",
	GSI_OWNER_ATTR_CREATEDAT = "createdAt",
}

// Filter on a unique status key so that the itemId does not need to be excluded from 
// the primary workflow. An exclusion list does not need to be maintained. New unique 
// status keys can be added without conflicts.
export enum ItemStatus {
	PROCESSING = "processing",
	COMPLETED = "completed",
	UPDATED = "updated",
	GENERATE = "generate",
	DOCIMPORT = "docimport",
	FAILED_UNRECOGNISEDMODEL = "failed_unrecognisedModel",
}

export enum ItemType {
	TEXT = "text",
	IMAGE = "image",
}

export enum Bucket {
	PREFIX_PRIVATE = "private",
}

export enum ModelId {
    ANTHROPIC_CLAUDE_V2 = "anthropic.claude-v2",
    ANTHROPIC_CLAUDE_3_SONNET = "anthropic.claude-3-sonnet-v1",
    AMAZON_TITAN_TEXT = "amazon.titan-text-lite-v1",
    AMAZON_TITAN_IMAGE = "amazon.titan-image-generator-v1",
    STABILITY_DIFFUSION = "stability.stable-diffusion-xl-v1"
}
