package migrations

import (
	"context"

	"github.com/apache/answer/internal/entity"
	"xorm.io/xorm"
)

func addAIChatSetting(ctx context.Context, x *xorm.Engine) error {
	if err := x.Context(ctx).Sync(new(entity.AIChatSetting)); err != nil {
		return err
	}
	exist, err := x.Context(ctx).ID(1).Exist(new(entity.AIChatSetting))
	if err != nil || exist {
		return err
	}
	_, err = x.Context(ctx).Insert(&entity.AIChatSetting{ID: 1})
	return err
}
