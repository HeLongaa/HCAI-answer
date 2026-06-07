package migrations

import (
	"context"
	"fmt"

	"github.com/apache/answer/internal/entity"
	"xorm.io/xorm"
	"xorm.io/xorm/schemas"
)

const pointTransactionSourceIndex = "UQE_point_transaction_point_source"

func ensurePointTransactionUniqueSourceIndex(ctx context.Context, x *xorm.Engine) error {
	if err := deduplicatePointTransactions(ctx, x); err != nil {
		return err
	}
	exists, err := indexExists(ctx, x, "point_transaction", pointTransactionSourceIndex)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	switch x.Dialect().URI().DBType {
	case schemas.MYSQL:
		_, err = x.Context(ctx).Exec(fmt.Sprintf(
			"CREATE UNIQUE INDEX %s ON point_transaction (user_id, source_type, source_id)",
			pointTransactionSourceIndex,
		))
	case schemas.POSTGRES:
		_, err = x.Context(ctx).Exec(fmt.Sprintf(
			"CREATE UNIQUE INDEX %s ON point_transaction (user_id, source_type, source_id)",
			pointTransactionSourceIndex,
		))
	default:
		_, err = x.Context(ctx).Exec(fmt.Sprintf(
			"CREATE UNIQUE INDEX %s ON point_transaction (user_id, source_type, source_id)",
			pointTransactionSourceIndex,
		))
	}
	if err != nil {
		return fmt.Errorf("create point transaction source index failed: %w", err)
	}
	return nil
}

func deduplicatePointTransactions(ctx context.Context, x *xorm.Engine) error {
	rows, err := x.Context(ctx).QueryString(`
SELECT user_id, source_type, source_id
FROM point_transaction
GROUP BY user_id, source_type, source_id
HAVING COUNT(*) > 1`)
	if err != nil {
		return fmt.Errorf("query duplicate point transactions failed: %w", err)
	}
	for _, row := range rows {
		userID := row["user_id"]
		sourceType := row["source_type"]
		sourceID := row["source_id"]
		transactions := make([]*entity.PointTransaction, 0)
		if err = x.Context(ctx).
			Where("user_id = ? AND source_type = ? AND source_id = ?", userID, sourceType, sourceID).
			Asc("id").
			Find(&transactions); err != nil {
			return fmt.Errorf("list duplicate point transactions failed: %w", err)
		}
		if len(transactions) <= 1 {
			continue
		}
		duplicateIDs := make([]int, 0, len(transactions)-1)
		duplicateDelta := 0
		for _, transaction := range transactions[1:] {
			duplicateIDs = append(duplicateIDs, transaction.ID)
			duplicateDelta += transaction.Delta
		}
		session := x.NewSession()
		session.Context(ctx)
		if err = session.Begin(); err != nil {
			session.Close()
			return err
		}
		if _, err = session.In("id", duplicateIDs).Delete(new(entity.PointTransaction)); err != nil {
			_ = session.Rollback()
			session.Close()
			return fmt.Errorf("delete duplicate point transactions failed: %w", err)
		}
		if duplicateDelta != 0 {
			if _, err = session.ID(userID).Incr("balance", -duplicateDelta).Update(&entity.UserPointAccount{}); err != nil {
				_ = session.Rollback()
				session.Close()
				return fmt.Errorf("repair point account balance failed: %w", err)
			}
		}
		if err = session.Commit(); err != nil {
			session.Close()
			return err
		}
		session.Close()
	}
	return nil
}

func indexExists(ctx context.Context, x *xorm.Engine, table, index string) (bool, error) {
	switch x.Dialect().URI().DBType {
	case schemas.MYSQL:
		rows, err := x.Context(ctx).QueryString(
			"SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
			table,
			index,
		)
		return len(rows) > 0, err
	case schemas.POSTGRES:
		rows, err := x.Context(ctx).QueryString(
			"SELECT indexname FROM pg_indexes WHERE tablename = $1 AND indexname = $2",
			table,
			index,
		)
		return len(rows) > 0, err
	default:
		rows, err := x.Context(ctx).QueryString(fmt.Sprintf("PRAGMA index_list(%s)", table))
		if err != nil {
			return false, err
		}
		for _, row := range rows {
			if row["name"] == index {
				return true, nil
			}
		}
		return false, nil
	}
}
