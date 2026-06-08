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

import { FC, useState } from 'react';
import { Link } from 'react-router-dom';

import { Avatar, Empty, Icon } from '@/components';
import no1Medal from '@/assets/images/leaderboard/no1.png';
import no2Medal from '@/assets/images/leaderboard/no2.png';
import no3Medal from '@/assets/images/leaderboard/no3.png';
import { usePageTags } from '@/hooks';
import {
  ContributionRankingUser,
  useContributionRanking,
  PointRankingUser,
  usePointRanking,
} from '@/services';
import { formatCount } from '@/utils';

import './index.scss';

type LeaderboardMode = 'points' | 'contribution';

type RankingItem = {
  username: string;
  displayName: string;
  avatar: string;
  value: number;
};

const modeOptions: Array<{
  key: LeaderboardMode;
  label: string;
  icon: string;
}> = [
  { key: 'points', label: '积分排行榜', icon: 'coin' },
  { key: 'contribution', label: '贡献值排行榜', icon: 'stars' },
];

const mapPointUser = (user: PointRankingUser): RankingItem => ({
  username: user.username,
  displayName: user.display_name || user.username,
  avatar: user.avatar,
  value: user.balance,
});

const mapContributionUser = (user: ContributionRankingUser): RankingItem => ({
  username: user.username,
  displayName: user.display_name || user.username,
  avatar: user.avatar,
  value: user.rank,
});

const podiumOrder = [1, 0, 2];
const podiumTitles: Record<number, string> = {
  1: '王者之位',
  2: '实力不凡',
  3: '潜力之星',
};
const podiumMedals: Record<number, string> = {
  1: no1Medal,
  2: no2Medal,
  3: no3Medal,
};

const LeaderboardPodiumCard: FC<{
  item: RankingItem;
  place: number;
}> = ({ item, place }) => (
  <Link
    className={`leaderboard-podium-card leaderboard-podium-card-${place}`}
    to={`/users/${item.username}`}>
    <span className="leaderboard-medal-wrap">
      <img
        className="leaderboard-medal-image"
        src={podiumMedals[place]}
        alt={`第 ${place} 名`}
      />
    </span>
    <Avatar
      size={place === 1 ? '58px' : '52px'}
      avatar={item.avatar}
      searchStr={place === 1 ? 's=116' : 's=104'}
      alt={item.displayName}
      className="leaderboard-podium-avatar"
    />
    <span className="leaderboard-podium-user">
      <strong>{item.displayName}</strong>
    </span>
    <span className="leaderboard-podium-score">
      <strong>{formatCount(item.value)}</strong>
    </span>
    <span className="leaderboard-podium-title">{podiumTitles[place]}</span>
  </Link>
);

const LeaderboardRow: FC<{
  item: RankingItem;
  place: number;
  metricLabel: string;
}> = ({ item, place, metricLabel }) => {
  return (
    <Link className="leaderboard-row" to={`/users/${item.username}`}>
      <span className={`leaderboard-rank leaderboard-rank-${place}`}>
        {place}
      </span>
      <Avatar
        size="44px"
        avatar={item.avatar}
        searchStr="s=88"
        alt={item.displayName}
      />
      <span className="leaderboard-user">
        <strong>{item.displayName}</strong>
        <span>@{item.username}</span>
      </span>
      <span className="leaderboard-score">
        <strong>{formatCount(item.value)}</strong>
        <span>{metricLabel}</span>
      </span>
    </Link>
  );
};

const Leaderboard: FC = () => {
  const [mode, setMode] = useState<LeaderboardMode>('points');
  const { data: pointUsers } = usePointRanking();
  const { data: contributionUsers } = useContributionRanking();

  usePageTags({ title: '排行榜' });

  const list =
    mode === 'points'
      ? (pointUsers || []).map(mapPointUser)
      : (contributionUsers || []).map(mapContributionUser);
  const loading = mode === 'points' ? !pointUsers : !contributionUsers;
  const metricLabel = mode === 'points' ? '积分' : '贡献值';
  const podiumItems = list.slice(0, 3);
  const podiumUsernames = new Set(podiumItems.map((item) => item.username));
  const rowItems = list.filter((item) => !podiumUsernames.has(item.username));
  const placeByUsername = new Map(
    list.map((item, index) => [item.username, index + 1]),
  );

  return (
    <main className="leaderboard-page">
      <header className="leaderboard-head">
        <div>
          <span className="leaderboard-kicker">Leaderboard</span>
          <h1>排行榜</h1>
          <p>查看社区成员的积分和贡献值排名。</p>
        </div>
        <div className="leaderboard-mode-switch" role="tablist">
          {modeOptions.map((option) => (
            <button
              type="button"
              role="tab"
              aria-selected={mode === option.key}
              className={mode === option.key ? 'is-active' : ''}
              key={option.key}
              onClick={() => setMode(option.key)}>
              <Icon name={option.icon} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </header>

      <section className="leaderboard-list" aria-live="polite">
        {loading ? (
          <div className="leaderboard-loading">加载中...</div>
        ) : list.length > 0 ? (
          <>
            {podiumItems.length > 0 && (
              <div
                className={`leaderboard-podium leaderboard-podium-count-${podiumItems.length}`}
                aria-label="排行榜前三名">
                {podiumOrder
                  .map((podiumIndex) => podiumItems[podiumIndex])
                  .filter(Boolean)
                  .map((item) => (
                    <LeaderboardPodiumCard
                      item={item}
                      place={placeByUsername.get(item.username) || 0}
                      key={item.username}
                    />
                  ))}
              </div>
            )}

            {rowItems.length > 0 && (
              <div className="leaderboard-rows">
                {rowItems.map((item) => (
                  <LeaderboardRow
                    item={item}
                    place={placeByUsername.get(item.username) || 0}
                    metricLabel={metricLabel}
                    key={item.username}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <Empty>暂无排行榜数据</Empty>
        )}
      </section>
    </main>
  );
};

export default Leaderboard;
