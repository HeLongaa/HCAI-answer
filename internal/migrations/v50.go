package migrations

import (
	"context"

	"github.com/apache/answer/internal/entity"
	"xorm.io/xorm"
)

func addInspirationLibrary(ctx context.Context, x *xorm.Engine) error {
	if err := x.Context(ctx).Sync(
		new(entity.Inspiration),
		new(entity.InspirationReaction),
		new(entity.InspirationFavorite),
		new(entity.InspirationComment),
		new(entity.InspirationReport),
		new(entity.InspirationViewLog),
		new(entity.InspirationSetting),
	); err != nil {
		return err
	}
	exist, err := x.Context(ctx).ID(1).Exist(new(entity.InspirationSetting))
	if err != nil || exist {
		return err
	}
	_, err = x.Context(ctx).Insert(&entity.InspirationSetting{
		ID:                        1,
		PublishRewardEnabled:      true,
		PublishRewardPoints:       5,
		RevokeRewardOnDelete:      true,
		FeaturedDefaultWeight:     100,
		RecommendationHotWeight:   3,
		RecommendationFreshWeight: 1,
	})
	return err
}
