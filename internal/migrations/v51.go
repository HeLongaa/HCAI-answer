package migrations

import (
	"context"

	"github.com/apache/answer/internal/entity"
	"xorm.io/xorm"
)

func addInspirationCategoriesSetting(ctx context.Context, x *xorm.Engine) error {
	if err := x.Context(ctx).Sync(new(entity.InspirationSetting)); err != nil {
		return err
	}
	setting := &entity.InspirationSetting{ID: 1}
	has, err := x.Context(ctx).Get(setting)
	if err != nil {
		return err
	}
	if !has || setting.Categories != "" {
		return nil
	}
	setting.Categories = `["Chat 提示词","图片生成","视频生成","编程开发","写作辅助","数据分析","办公效率","角色扮演"]`
	_, err = x.Context(ctx).ID(1).Cols("categories").Update(setting)
	return err
}
