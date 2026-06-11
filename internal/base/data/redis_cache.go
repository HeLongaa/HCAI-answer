/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package data

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	pacmanCache "github.com/segmentfault/pacman/cache"
)

var _ pacmanCache.Cache = (*RedisCache)(nil)

type RedisCache struct {
	client    *redis.Client
	keyPrefix string
}

func NewRedisCache(c *CacheConf) (*RedisCache, func(), error) {
	options, err := redisOptions(c)
	if err != nil {
		return nil, nil, err
	}
	client := redis.NewClient(options)
	if err := client.Ping(context.Background()).Err(); err != nil {
		_ = client.Close()
		return nil, nil, err
	}
	cleanup := func() {
		_ = client.Close()
	}
	return &RedisCache{client: client, keyPrefix: c.KeyPrefix}, cleanup, nil
}

func redisOptions(c *CacheConf) (*redis.Options, error) {
	rawURL := strings.TrimSpace(c.URL)
	if rawURL == "" && strings.HasPrefix(strings.TrimSpace(c.Addr), "redis://") {
		rawURL = strings.TrimSpace(c.Addr)
	}
	if rawURL != "" {
		options, err := redis.ParseURL(rawURL)
		if err != nil {
			return nil, fmt.Errorf("parse redis url: %w", err)
		}
		return options, nil
	}

	addr := c.Addr
	if addr == "" {
		addr = "127.0.0.1:6379"
	}
	options := &redis.Options{
		Addr:     addr,
		Username: c.Username,
		Password: c.Password,
		DB:       c.DB,
	}
	if strings.Contains(addr, "://") {
		parsed, err := url.Parse(addr)
		if err != nil {
			return nil, fmt.Errorf("parse redis addr: %w", err)
		}
		options.Addr = parsed.Host
		if parsed.User != nil {
			options.Username = parsed.User.Username()
			options.Password, _ = parsed.User.Password()
		}
		if db, err := strconv.Atoi(strings.TrimPrefix(parsed.Path, "/")); err == nil {
			options.DB = db
		}
	}
	return options, nil
}

func (c *RedisCache) cacheKey(key string) string {
	return c.keyPrefix + key
}

func (c *RedisCache) GetString(ctx context.Context, key string) (data string, exist bool, err error) {
	value, err := c.client.Get(ctx, c.cacheKey(key)).Result()
	if errors.Is(err, redis.Nil) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return value, true, nil
}

func (c *RedisCache) SetString(ctx context.Context, key, value string, ttl time.Duration) error {
	return c.client.Set(ctx, c.cacheKey(key), value, ttl).Err()
}

func (c *RedisCache) GetInt64(ctx context.Context, key string) (data int64, exist bool, err error) {
	value, err := c.client.Get(ctx, c.cacheKey(key)).Int64()
	if errors.Is(err, redis.Nil) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	return value, true, nil
}

func (c *RedisCache) SetInt64(ctx context.Context, key string, value int64, ttl time.Duration) error {
	return c.client.Set(ctx, c.cacheKey(key), value, ttl).Err()
}

func (c *RedisCache) Increase(ctx context.Context, key string, value int64) (data int64, err error) {
	return c.client.IncrBy(ctx, c.cacheKey(key), value).Result()
}

func (c *RedisCache) Decrease(ctx context.Context, key string, value int64) (data int64, err error) {
	return c.client.DecrBy(ctx, c.cacheKey(key), value).Result()
}

func (c *RedisCache) Del(ctx context.Context, key string) error {
	return c.client.Del(ctx, c.cacheKey(key)).Err()
}

func (c *RedisCache) Flush(ctx context.Context) error {
	if c.keyPrefix == "" {
		return c.client.FlushDB(ctx).Err()
	}
	iter := c.client.Scan(ctx, 0, c.keyPrefix+"*", 100).Iterator()
	for iter.Next(ctx) {
		if err := c.client.Del(ctx, iter.Val()).Err(); err != nil {
			return err
		}
	}
	return iter.Err()
}
