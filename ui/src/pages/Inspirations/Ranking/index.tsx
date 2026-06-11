import { FC } from 'react';
import { Link } from 'react-router-dom';

import { FormatTime } from '@/components';
import { useInspirations } from '@/services';
import { usePageTags } from '@/hooks';

import '../index.scss';

const PAGE_SIZE = 30;

const compactNumber = (value: number) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
};

const InspirationRanking: FC = () => {
  const { data } = useInspirations({
    page: 1,
    page_size: PAGE_SIZE,
    sort: 'hot',
  });

  usePageTags({ title: '灵感排行榜' });

  return (
    <main className="inspiration-page">
      <section className="inspiration-rank-page">
        <div className="inspiration-tags-head">
          <Link className="inspiration-tags-back" to="/inspirations">
            <i className="bi bi-chevron-left" />
            返回灵感库
          </Link>
          <span>Ranking</span>
          <h1>本周热门</h1>
          <p>按浏览、点赞、收藏等热度综合排序，快速发现高价值灵感。</p>
        </div>

        <ol className="inspiration-rank-list">
          {(data?.list || []).map((item, index) => (
            <li key={item.id}>
              <b>{index + 1}</b>
              <Link to={`/inspirations/${item.id}`}>
                {item.cover_url ? <img src={item.cover_url} alt="" /> : null}
                <span>
                  <small>{item.category || item.type || '灵感'}</small>
                  <strong>{item.title}</strong>
                  <em>{item.summary || item.content}</em>
                </span>
                <i className="bi bi-chevron-right" />
              </Link>
              <div>
                <span>
                  <i className="bi bi-eye" /> {compactNumber(item.view_count)}
                </span>
                <span>
                  <i className="bi bi-hand-thumbs-up" />{' '}
                  {compactNumber(item.like_count)}
                </span>
                <FormatTime time={item.published_at || item.created_at} />
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
};

export default InspirationRanking;
