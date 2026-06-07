package migrations

import (
	"context"
	"fmt"

	"github.com/apache/answer/internal/entity"
	"xorm.io/xorm"
	"xorm.io/xorm/schemas"
)

const featuredPostQuestionUniqueIndex = "UQE_featured_post_question_id"

func allowFeaturedPostHistory(ctx context.Context, x *xorm.Engine) error {
	exists, err := indexExists(ctx, x, "featured_post", featuredPostQuestionUniqueIndex)
	if err != nil {
		return err
	}
	if exists {
		if err = dropIndex(ctx, x, "featured_post", featuredPostQuestionUniqueIndex); err != nil {
			return fmt.Errorf("drop featured post question unique index failed: %w", err)
		}
	}
	if err = x.Context(ctx).Sync(new(entity.FeaturedPost)); err != nil {
		return fmt.Errorf("sync featured post indexes failed: %w", err)
	}
	return nil
}

func dropIndex(ctx context.Context, x *xorm.Engine, table, index string) error {
	var sql string
	switch x.Dialect().URI().DBType {
	case schemas.MYSQL:
		sql = fmt.Sprintf("DROP INDEX %s ON %s", index, table)
	default:
		sql = fmt.Sprintf("DROP INDEX %s", index)
	}
	_, err := x.Context(ctx).Exec(sql)
	return err
}
