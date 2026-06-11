import { FC } from 'react';
import { Link } from 'react-router-dom';

import { useInspirationTaxonomy } from '@/services';
import { usePageTags } from '@/hooks';

import '../index.scss';

const toneClass = (index: number) => `tone-${(index % 4) + 1}`;

const InspirationTags: FC = () => {
  const { data } = useInspirationTaxonomy();
  const tags = data?.tags || [];

  usePageTags({ title: '灵感标签' });

  return (
    <main className="inspiration-page">
      <section className="inspiration-tags-page">
        <div className="inspiration-tags-head">
          <Link className="inspiration-tags-back" to="/inspirations">
            <i className="bi bi-chevron-left" />
            返回灵感库
          </Link>
          <span>Tags</span>
          <h1>全部标签</h1>
          <p>按标签浏览灵感内容，点击标签即可进入筛选结果。</p>
        </div>

        <div className="inspiration-tags-grid">
          {tags.length ? (
            tags.map((item, index) => (
              <Link
                className={`inspiration-tags-item ${toneClass(index)}`}
                key={item.name}
                to={`/inspirations?tag=${encodeURIComponent(item.name)}`}>
                <strong>{item.name}</strong>
                <span>{item.count} 条内容</span>
                <i className="bi bi-chevron-right" />
              </Link>
            ))
          ) : (
            <div className="inspiration-empty">暂无标签</div>
          )}
        </div>
      </section>
    </main>
  );
};

export default InspirationTags;
