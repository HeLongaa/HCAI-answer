package migrations

import (
	"context"
	"fmt"

	"github.com/apache/answer/internal/entity"
	"xorm.io/xorm"
	"xorm.io/xorm/schemas"
)

func ensureAIImageModelConfigColumns(ctx context.Context, x *xorm.Engine) error {
	if err := ensureAIImageProviderColumns(ctx, x); err != nil {
		return err
	}
	if err := ensureAIImageModelColumns(ctx, x); err != nil {
		return err
	}
	if err := ensureAIImageGenerationColumns(ctx, x); err != nil {
		return err
	}
	if err := x.Context(ctx).Sync(
		new(entity.AIImageModel),
		new(entity.AIImageGeneration),
		new(entity.AIImageAgentConversation),
	); err != nil {
		return fmt.Errorf("ensure ai image model config columns failed: %w", err)
	}
	return nil
}

func ensureAIImageProviderColumns(ctx context.Context, x *xorm.Engine) error {
	switch x.Dialect().URI().DBType {
	case schemas.MYSQL:
		return ensureColumns(ctx, x, "ai_image_providers", map[string]string{
			"api_format":            "VARCHAR(50) NOT NULL DEFAULT 'openai'",
			"flow2api_model_groups": "TEXT NULL",
		})
	case schemas.POSTGRES:
		return ensureColumns(ctx, x, "ai_image_providers", map[string]string{
			"api_format":            "VARCHAR(50) NOT NULL DEFAULT 'openai'",
			"flow2api_model_groups": "TEXT NOT NULL DEFAULT ''",
		})
	default:
		return ensureColumns(ctx, x, "ai_image_providers", map[string]string{
			"api_format":            "TEXT NOT NULL DEFAULT 'openai'",
			"flow2api_model_groups": "TEXT NOT NULL DEFAULT ''",
		})
	}
}

func ensureAIImageModelColumns(ctx context.Context, x *xorm.Engine) error {
	switch x.Dialect().URI().DBType {
	case schemas.MYSQL:
		return ensureColumns(ctx, x, "ai_image_models", map[string]string{
			"api_mode":            "VARCHAR(50) NOT NULL DEFAULT 'images'",
			"supports_edits":      "BOOL NOT NULL DEFAULT TRUE",
			"supports_references": "BOOL NOT NULL DEFAULT TRUE",
			"supports_stream":     "BOOL NOT NULL DEFAULT FALSE",
			"default_quality":     "VARCHAR(50) NOT NULL DEFAULT 'auto'",
			"default_format":      "VARCHAR(50) NOT NULL DEFAULT 'png'",
			"extra_config":        "TEXT NULL",
		})
	case schemas.POSTGRES:
		return ensureColumns(ctx, x, "ai_image_models", map[string]string{
			"api_mode":            "VARCHAR(50) NOT NULL DEFAULT 'images'",
			"supports_edits":      "BOOLEAN NOT NULL DEFAULT TRUE",
			"supports_references": "BOOLEAN NOT NULL DEFAULT TRUE",
			"supports_stream":     "BOOLEAN NOT NULL DEFAULT FALSE",
			"default_quality":     "VARCHAR(50) NOT NULL DEFAULT 'auto'",
			"default_format":      "VARCHAR(50) NOT NULL DEFAULT 'png'",
			"extra_config":        "TEXT NOT NULL DEFAULT ''",
		})
	default:
		return ensureColumns(ctx, x, "ai_image_models", map[string]string{
			"api_mode":            "TEXT NOT NULL DEFAULT 'images'",
			"supports_edits":      "INTEGER NOT NULL DEFAULT 1",
			"supports_references": "INTEGER NOT NULL DEFAULT 1",
			"supports_stream":     "INTEGER NOT NULL DEFAULT 0",
			"default_quality":     "TEXT NOT NULL DEFAULT 'auto'",
			"default_format":      "TEXT NOT NULL DEFAULT 'png'",
			"extra_config":        "TEXT NOT NULL DEFAULT ''",
		})
	}
}

func ensureAIImageGenerationColumns(ctx context.Context, x *xorm.Engine) error {
	switch x.Dialect().URI().DBType {
	case schemas.MYSQL:
		return ensureColumns(ctx, x, "ai_image_generations", map[string]string{
			"output_format":    "VARCHAR(50) NOT NULL DEFAULT ''",
			"compression":      "INT(11) NOT NULL DEFAULT 0",
			"moderation":       "VARCHAR(50) NOT NULL DEFAULT ''",
			"background":       "VARCHAR(50) NOT NULL DEFAULT ''",
			"reference_images": "TEXT NULL",
			"mask_image":       "TEXT NULL",
			"api_mode":         "VARCHAR(50) NOT NULL DEFAULT ''",
			"response_id":      "VARCHAR(255) NOT NULL DEFAULT ''",
			"response_output":  "TEXT NULL",
		})
	case schemas.POSTGRES:
		return ensureColumns(ctx, x, "ai_image_generations", map[string]string{
			"output_format":    "VARCHAR(50) NOT NULL DEFAULT ''",
			"compression":      "INTEGER NOT NULL DEFAULT 0",
			"moderation":       "VARCHAR(50) NOT NULL DEFAULT ''",
			"background":       "VARCHAR(50) NOT NULL DEFAULT ''",
			"reference_images": "TEXT NOT NULL DEFAULT ''",
			"mask_image":       "TEXT NOT NULL DEFAULT ''",
			"api_mode":         "VARCHAR(50) NOT NULL DEFAULT ''",
			"response_id":      "VARCHAR(255) NOT NULL DEFAULT ''",
			"response_output":  "TEXT NOT NULL DEFAULT ''",
		})
	default:
		return ensureColumns(ctx, x, "ai_image_generations", map[string]string{
			"output_format":    "TEXT NOT NULL DEFAULT ''",
			"compression":      "INTEGER NOT NULL DEFAULT 0",
			"moderation":       "TEXT NOT NULL DEFAULT ''",
			"background":       "TEXT NOT NULL DEFAULT ''",
			"reference_images": "TEXT NOT NULL DEFAULT ''",
			"mask_image":       "TEXT NOT NULL DEFAULT ''",
			"api_mode":         "TEXT NOT NULL DEFAULT ''",
			"response_id":      "TEXT NOT NULL DEFAULT ''",
			"response_output":  "TEXT NOT NULL DEFAULT ''",
		})
	}
}

func ensureColumns(ctx context.Context, x *xorm.Engine, table string, columns map[string]string) error {
	for column, definition := range columns {
		exists, err := columnExists(ctx, x, table, column)
		if err != nil {
			return err
		}
		if exists {
			continue
		}
		if _, err = x.Context(ctx).Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, definition)); err != nil {
			return fmt.Errorf("add column %s.%s failed: %w", table, column, err)
		}
	}
	return nil
}

func columnExists(ctx context.Context, x *xorm.Engine, table, column string) (bool, error) {
	switch x.Dialect().URI().DBType {
	case schemas.MYSQL:
		rows, err := x.Context(ctx).QueryString(
			"SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
			table,
			column,
		)
		return len(rows) > 0, err
	case schemas.POSTGRES:
		rows, err := x.Context(ctx).QueryString(
			"SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
			table,
			column,
		)
		return len(rows) > 0, err
	default:
		rows, err := x.Context(ctx).QueryString(fmt.Sprintf("PRAGMA table_info(%s)", table))
		if err != nil {
			return false, err
		}
		for _, row := range rows {
			if row["name"] == column {
				return true, nil
			}
		}
		return false, nil
	}
}
