import { FC, ReactNode, useMemo, useRef, useState } from 'react';
import { Button, Dropdown, Form } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';

import { Avatar, FormatTime, Pagination } from '@/components';
import {
  InspirationItem,
  useInspirationAuthorRanking,
  useInspirations,
  useInspirationTaxonomy,
} from '@/services';
import { usePageTags } from '@/hooks';

import './index.scss';

const PAGE_SIZE = 12;

const defaultCategories = [
  '全部',
  'Chat 提示词',
  '图片生成',
  '视频生成',
  '编程开发',
  '写作辅助',
  '数据分析',
  '办公效率',
  '角色扮演',
];

const sortOptions = [
  { key: '', label: '最新发布' },
  { key: 'recommend', label: '推荐排序' },
  { key: 'hot', label: '热度排序' },
  { key: 'popular', label: '排行榜' },
] as const;

type InspirationSort = (typeof sortOptions)[number]['key'];

interface InspirationSelectOption {
  value: string;
  label: string;
}

const InspirationSelect: FC<{
  value: string;
  options: InspirationSelectOption[];
  onChange: (value: string) => void;
}> = ({ value, options, onChange }) => {
  const current =
    options.find((option) => option.value === value) || options[0];

  return (
    <Dropdown
      className="inspiration-select"
      onSelect={(nextValue) => onChange(nextValue || '')}>
      <Dropdown.Toggle variant="outline-secondary">
        {current?.label}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {options.map((option) => (
          <Dropdown.Item
            active={option.value === value}
            eventKey={option.value}
            key={option.value || 'all'}>
            {option.label}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
};

const compactNumber = (value: number) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 1 : 1)}k`;
  }
  return String(value);
};

const parseSort = (value: string | null): InspirationSort => {
  const nextSort = value || '';
  return sortOptions.some((item) => item.key === nextSort)
    ? (nextSort as InspirationSort)
    : '';
};

const ItemLink: FC<{
  item: InspirationItem;
  className?: string;
  children: ReactNode;
}> = ({ item, className, children }) => (
  <Link className={className} to={`/inspirations/${item.id}`}>
    {children}
  </Link>
);

const FeaturedCard: FC<{ item: InspirationItem }> = ({ item }) => (
  <ItemLink className="inspiration-featured-card" item={item}>
    <div className="inspiration-featured-cover">
      <img src={item.cover_url} alt="" />
      <span>{item.category || '精选灵感'}</span>
    </div>
    <div className="inspiration-featured-body">
      <h3>{item.title}</h3>
      <p>{item.summary || item.content}</p>
      <div className="inspiration-featured-author">
        <Avatar
          avatar={item.user_avatar}
          size="18px"
          alt={item.user_display_name || item.username || 'Creator'}
        />
        <span>@{item.user_display_name || item.username || 'Creator'}</span>
      </div>
      <div className="inspiration-featured-stats">
        <span>
          <i className="bi bi-eye" /> {compactNumber(item.view_count)}
        </span>
        <span>
          <i className="bi bi-hand-thumbs-up" />{' '}
          {compactNumber(item.like_count)}
        </span>
        <i className="bi bi-bookmark" />
      </div>
    </div>
  </ItemLink>
);

const InspirationRow: FC<{ item: InspirationItem }> = ({ item }) => (
  <ItemLink className="inspiration-row" item={item}>
    <img className="inspiration-row-cover" src={item.cover_url} alt="" />
    <div className="inspiration-row-content">
      <div className="inspiration-row-title">
        <span>{item.category || '灵感推荐'}</span>
        <h3>{item.title}</h3>
      </div>
      <p>{item.summary || item.content}</p>
      <div className="inspiration-row-author">
        <Avatar
          avatar={item.user_avatar}
          size="18px"
          alt={item.user_display_name || item.username || 'Creator'}
        />
        <span>@{item.user_display_name || item.username || 'Creator'}</span>
        <b>·</b>
        <FormatTime time={item.published_at || item.created_at} />
      </div>
    </div>
    <div className="inspiration-row-stats">
      <span>
        <i className="bi bi-eye" /> {compactNumber(item.view_count)}
      </span>
      <span>
        <i className="bi bi-hand-thumbs-up" /> {compactNumber(item.like_count)}
      </span>
      <i className="bi bi-bookmark" />
    </div>
  </ItemLink>
);

const Inspirations: FC = () => {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page')) || 1;
  const sort = parseSort(params.get('sort'));
  const query = params.get('q') || '';
  const category = params.get('category') || '';
  const tag = params.get('tag') || '';
  const mine = params.get('mine') === '1';
  const [draftQuery, setDraftQuery] = useState(query);
  const featuredRef = useRef<HTMLDivElement>(null);
  const { data } = useInspirations({
    page,
    page_size: PAGE_SIZE,
    q: query || undefined,
    category: category || undefined,
    tag: tag || undefined,
    mine: mine ? 'true' : undefined,
    sort: sort || undefined,
  });
  const { data: featured } = useInspirations({
    page: 1,
    page_size: 12,
    sort: 'featured',
    featured: 'true',
  });
  const { data: hot } = useInspirations({
    page: 1,
    page_size: 5,
    sort: 'hot',
  });
  const { data: authors } = useInspirationAuthorRanking();
  const { data: taxonomy } = useInspirationTaxonomy();

  usePageTags({ title: '灵感库' });

  const listItems = data?.list || [];
  const featuredItems = featured?.list || [];
  const hotItems = hot?.list || [];
  const tagItems = taxonomy?.tags?.slice(0, 8) || [];
  const categories = useMemo(() => {
    const configured = (taxonomy?.categories || []).map((item) => item.name);
    return configured.length ? ['全部', ...configured] : defaultCategories;
  }, [taxonomy?.categories]);

  const activeCategory = category || '全部';
  const currentSortLabel = useMemo(
    () => sortOptions.find((item) => item.key === sort)?.label || '最新发布',
    [sort],
  );
  const categoryOptions = useMemo(
    () =>
      categories.map((item) => ({
        value: item === '全部' ? '' : item,
        label: item === '全部' ? '全部类型' : item,
      })),
    [categories],
  );

  const updateParams = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    next.delete('page');
    Object.entries(values).forEach(([key, value]) => {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    });
    setParams(next);
  };

  const search = () => updateParams({ q: draftQuery.trim() });
  const scrollFeatured = (direction: -1 | 1) => {
    const grid = featuredRef.current;
    if (!grid) {
      return;
    }
    grid.scrollBy({
      left: direction * Math.max(220, grid.clientWidth * 0.72),
      behavior: 'smooth',
    });
  };

  return (
    <main className="inspiration-page">
      <section className="inspiration-hero">
        <div className="inspiration-hero-copy">
          <h1>
            <i className="bi bi-stars" />
            灵感库
          </h1>
          <p>发现优质提示词与实用 Skill，一键复用创作灵感</p>
        </div>
        <div className="inspiration-hero-art" aria-hidden="true">
          <div className="inspiration-folder">
            <span />
            <span />
          </div>
          <div className="inspiration-bulb">
            <i className="bi bi-lightbulb-fill" />
          </div>
          <i className="bi bi-stars inspiration-spark-one" />
          <i className="bi bi-stars inspiration-spark-two" />
        </div>
        <div className="inspiration-search">
          <i className="bi bi-search" />
          <Form.Control
            value={draftQuery}
            placeholder="搜索提示词、Skill、创作者或标签..."
            onChange={(evt) => setDraftQuery(evt.target.value)}
            onKeyDown={(evt) => {
              if (evt.key === 'Enter') {
                search();
              }
            }}
          />
        </div>
        <Button
          className="inspiration-publish"
          as={Link as any}
          to="/inspirations/new">
          <i className="bi bi-plus-lg" />
          发布灵感
        </Button>
      </section>

      <nav className="inspiration-categories" aria-label="灵感分类">
        {categories.map((item) => (
          <button
            type="button"
            className={activeCategory === item ? 'active' : ''}
            key={item}
            onClick={() =>
              updateParams({ category: item === '全部' ? '' : item })
            }>
            {item}
          </button>
        ))}
      </nav>

      <div className="inspiration-dashboard">
        <div className="inspiration-primary">
          <section className="inspiration-section">
            <div className="inspiration-section-title">
              <h2>
                <i className="bi bi-hand-thumbs-up" />
                精选推荐
              </h2>
              {featuredItems.length > 3 ? (
                <div className="inspiration-section-actions">
                  <Button
                    aria-label="向左滚动精选推荐"
                    type="button"
                    variant="light"
                    onClick={() => scrollFeatured(-1)}>
                    <i className="bi bi-chevron-left" />
                  </Button>
                  <Button
                    aria-label="向右滚动精选推荐"
                    type="button"
                    variant="light"
                    onClick={() => scrollFeatured(1)}>
                    <i className="bi bi-chevron-right" />
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="inspiration-featured-grid" ref={featuredRef}>
              {featuredItems.length ? (
                featuredItems.map((item) => (
                  <FeaturedCard item={item} key={item.id} />
                ))
              ) : (
                <div className="inspiration-empty">暂无精选灵感</div>
              )}
            </div>
          </section>

          <section className="inspiration-latest">
            <div className="inspiration-latest-toolbar">
              <h2>{mine ? '我的灵感' : '最新灵感'}</h2>
              <InspirationSelect
                value={sort}
                options={sortOptions.map((item) => ({
                  value: item.key,
                  label: item.label,
                }))}
                onChange={(value) =>
                  updateParams({ sort: value as InspirationSort })
                }
              />
              <InspirationSelect
                value={category}
                options={categoryOptions}
                onChange={(value) => updateParams({ category: value })}
              />
              <span className="inspiration-current-sort">
                {currentSortLabel}
              </span>
              <Link to="/inspirations">查看全部</Link>
            </div>
            <div className="inspiration-row-list">
              {listItems.length ? (
                listItems.map((item) => (
                  <InspirationRow item={item} key={item.id} />
                ))
              ) : (
                <div className="inspiration-empty">暂无灵感内容</div>
              )}
            </div>
            {data?.list?.length ? (
              <Pagination
                currentPage={page}
                pageSize={PAGE_SIZE}
                totalSize={data.count}
              />
            ) : null}
          </section>
        </div>

        <aside className="inspiration-sidebar">
          <section className="inspiration-side-card">
            <div className="inspiration-side-title">
              <h2>热门标签</h2>
              <Link to="/inspirations/tags">
                全部标签 <i className="bi bi-chevron-right" />
              </Link>
            </div>
            <div className="inspiration-tag-cloud">
              {tagItems.map((item, index) => (
                <button
                  type="button"
                  className={`tone-${(index % 4) + 1}`}
                  key={item.name}
                  onClick={() => updateParams({ tag: item.name })}>
                  {item.name} <span>{compactNumber(item.count)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="inspiration-side-card">
            <div className="inspiration-side-title">
              <h2>本周热门</h2>
              <Link to="/inspirations/ranking">
                更多 <i className="bi bi-chevron-right" />
              </Link>
            </div>
            <ol className="inspiration-ranking">
              {hotItems.map((item, index) => (
                <li key={item.id}>
                  <b>{index + 1}</b>
                  <Link to={`/inspirations/${item.id}`}>{item.title}</Link>
                  <small>
                    <i className="bi bi-eye" /> {compactNumber(item.view_count)}
                  </small>
                </li>
              ))}
            </ol>
          </section>

          <section className="inspiration-side-card">
            <div className="inspiration-side-title">
              <h2>创作者榜</h2>
              <Link to="/inspirations/creators">
                更多 <i className="bi bi-chevron-right" />
              </Link>
            </div>
            <ol className="inspiration-creators">
              {(authors?.length ? authors.slice(0, 4) : []).map(
                (author, index) => (
                  <li key={author.user_id}>
                    <b>{index < 3 ? <i className="bi bi-crown-fill" /> : 4}</b>
                    <Avatar
                      size="32px"
                      alt={author.display_name || author.username}
                      avatar={author.avatar}
                    />
                    <span>@{author.display_name || author.username}</span>
                    <small>{compactNumber(author.hot_score)} 热度</small>
                  </li>
                ),
              )}
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
};

export default Inspirations;
