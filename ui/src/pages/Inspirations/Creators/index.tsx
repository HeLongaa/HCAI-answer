import { FC } from 'react';
import { Link } from 'react-router-dom';

import { Avatar } from '@/components';
import { useInspirationAuthorRanking } from '@/services';
import { usePageTags } from '@/hooks';

import '../index.scss';

const compactNumber = (value: number) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
};

const InspirationCreators: FC = () => {
  const { data } = useInspirationAuthorRanking();

  usePageTags({ title: '创作者榜' });

  return (
    <main className="inspiration-page">
      <section className="inspiration-rank-page">
        <div className="inspiration-tags-head">
          <Link className="inspiration-tags-back" to="/inspirations">
            <i className="bi bi-chevron-left" />
            返回灵感库
          </Link>
          <span>Creators</span>
          <h1>创作者榜</h1>
          <p>按灵感内容热度和发布数量综合排序，发现高质量创作者。</p>
        </div>

        <ol className="inspiration-creator-list">
          {(data || []).map((author, index) => (
            <li key={author.user_id}>
              <b>
                {index < 3 ? <i className="bi bi-crown-fill" /> : index + 1}
              </b>
              <Avatar
                avatar={author.avatar}
                size="48px"
                alt={author.display_name || author.username}
              />
              <Link to={`/users/${author.username}`}>
                @{author.display_name || author.username}
              </Link>
              <span>{compactNumber(author.hot_score)} 热度</span>
              <small>{author.count} 条灵感</small>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
};

export default InspirationCreators;
