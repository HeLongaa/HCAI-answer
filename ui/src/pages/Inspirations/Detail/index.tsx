import { FC, useRef, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Avatar, Empty, FormatTime } from '@/components';
import {
  addInspirationComment,
  deleteInspiration,
  favoriteInspiration,
  likeInspiration,
  reportInspiration,
  shareInspiration,
  unfavoriteInspiration,
  unlikeInspiration,
  useInspiration,
  useInspirationAuthorRanking,
  useInspirationComments,
  useInspirations,
  useInspirationTaxonomy,
} from '@/services';
import { toastStore } from '@/stores';
import { usePageTags } from '@/hooks';
import InspirationBackButton from '../BackButton';

import '../index.scss';

const getErrorMessage = (err: any, fallback: string) =>
  err?.msg || err?.message || fallback;

const compactNumber = (value: number) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
};

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }
};

const InspirationDetail: FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, mutate } = useInspiration(id);
  const { data: comments, mutate: mutateComments } = useInspirationComments(
    id,
    {
      page: 1,
      page_size: 50,
    },
  );
  const { data: taxonomy } = useInspirationTaxonomy();
  const { data: hot } = useInspirations({
    page: 1,
    page_size: 5,
    sort: 'hot',
  });
  const { data: authors } = useInspirationAuthorRanking();
  const [comment, setComment] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('内容不适合展示');
  const [reportContent, setReportContent] = useState('');
  const detailRef = useRef<HTMLElement>(null);

  usePageTags({ title: data?.title || '灵感详情' });

  const numericID = Number(id);

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/inspirations');
  };

  const toggleLike = async () => {
    if (!data) {
      return;
    }
    try {
      if (data.liked) {
        await unlikeInspiration(data.id);
      } else {
        await likeInspiration(data.id);
      }
      mutate();
    } catch (err: any) {
      toastStore
        .getState()
        .show({ msg: getErrorMessage(err, '操作失败'), variant: 'danger' });
    }
  };

  const toggleFavorite = async () => {
    if (!data) {
      return;
    }
    try {
      if (data.favorited) {
        await unfavoriteInspiration(data.id);
      } else {
        await favoriteInspiration(data.id);
      }
      mutate();
    } catch (err: any) {
      toastStore
        .getState()
        .show({ msg: getErrorMessage(err, '操作失败'), variant: 'danger' });
    }
  };

  const copyShare = async () => {
    if (!data) {
      return;
    }
    try {
      const copied = await copyText(window.location.href);
      if (!copied) {
        toastStore.getState().show({
          msg: '浏览器阻止自动复制，请手动复制地址栏链接',
          variant: 'warning',
        });
        return;
      }
      await shareInspiration(data.id);
      toastStore.getState().show({ msg: '链接已复制', variant: 'success' });
      mutate();
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '复制失败，请手动复制地址栏链接'),
        variant: 'danger',
      });
    }
  };

  const submitComment = async () => {
    if (!comment.trim() || !Number.isFinite(numericID)) {
      return;
    }
    try {
      await addInspirationComment(numericID, comment.trim());
      setComment('');
      mutate();
      mutateComments();
    } catch (err: any) {
      toastStore
        .getState()
        .show({ msg: getErrorMessage(err, '评论失败'), variant: 'danger' });
    }
  };

  const submitReport = async () => {
    if (!data) {
      return;
    }
    try {
      await reportInspiration(data.id, {
        reason: reportReason,
        content: reportContent,
      });
      toastStore.getState().show({ msg: '举报已提交', variant: 'success' });
      setShowReport(false);
      setReportContent('');
      mutate();
    } catch (err: any) {
      toastStore
        .getState()
        .show({ msg: getErrorMessage(err, '举报失败'), variant: 'danger' });
    }
  };

  const removeInspiration = async () => {
    if (!data) {
      return;
    }
    try {
      await deleteInspiration(data.id);
      toastStore.getState().show({ msg: '灵感已删除', variant: 'success' });
      navigate('/inspirations');
    } catch (err: any) {
      toastStore
        .getState()
        .show({ msg: getErrorMessage(err, '删除失败'), variant: 'danger' });
    }
  };

  if (!data) {
    return (
      <main className="inspiration-page">
        <Empty />
      </main>
    );
  }

  return (
    <main className="inspiration-page">
      <div className="inspiration-detail-layout">
        <article className="inspiration-detail" ref={detailRef}>
          <InspirationBackButton anchorRef={detailRef} onClick={goBack} />
          {data.cover_url ? (
            <div className="inspiration-detail-cover">
              <img src={data.cover_url} alt={data.title} />
            </div>
          ) : null}
          <header className="inspiration-detail-head">
            <span className="inspiration-detail-type">
              {data.type || 'Inspiration'}
            </span>
            <h1>{data.title}</h1>
            <p>{data.summary}</p>
            <div className="inspiration-detail-meta">
              <span>{data.user_display_name || data.username}</span>
              {data.published_at ? (
                <FormatTime time={data.published_at} />
              ) : null}
              {data.category ? <span>{data.category}</span> : null}
              {data.tags.map((tag) => (
                <span className="inspiration-tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </header>

          <div className="inspiration-detail-actions">
            <Button
              size="sm"
              variant={data.liked ? 'primary' : 'outline-primary'}
              onClick={toggleLike}>
              <i className="bi bi-hand-thumbs-up" /> 点赞 {data.like_count}
            </Button>
            <Button
              size="sm"
              variant={data.favorited ? 'primary' : 'outline-primary'}
              onClick={toggleFavorite}>
              <i className="bi bi-bookmark" /> 收藏 {data.favorite_count}
            </Button>
            <Button size="sm" variant="outline-secondary" onClick={copyShare}>
              <i className="bi bi-share" /> 转发/复制 {data.share_count}
            </Button>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => setShowReport(true)}>
              举报
            </Button>
            {data.can_edit ? (
              <Button
                as={Link as any}
                size="sm"
                variant="outline-primary"
                to={`/inspirations/${data.id}/edit`}>
                编辑
              </Button>
            ) : null}
            {data.can_edit ? (
              <Button
                size="sm"
                variant="outline-danger"
                onClick={removeInspiration}>
                删除
              </Button>
            ) : null}
            <span>
              <i className="bi bi-eye" /> 浏览 {compactNumber(data.view_count)}
            </span>
          </div>

          <section className="inspiration-detail-section">
            <p className="inspiration-detail-content">{data.content}</p>
          </section>

          {data.prompt ? (
            <section className="inspiration-detail-section">
              <h2>提示词</h2>
              <div className="inspiration-prompt">{data.prompt}</div>
            </section>
          ) : null}

          {data.links.length || data.attachments.length ? (
            <section className="inspiration-detail-section">
              <h2>附件/链接</h2>
              <div className="inspiration-side-list">
                {[...data.links, ...data.attachments].map((item) => (
                  <a href={item} target="_blank" rel="noreferrer" key={item}>
                    {item}
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <section className="inspiration-detail-section inspiration-comments">
            <h2>评论</h2>
            <div className="inspiration-comment-form">
              <Form.Control
                as="textarea"
                rows={3}
                value={comment}
                placeholder="写下你的评论"
                onChange={(evt) => setComment(evt.target.value)}
              />
              <Button onClick={submitComment} disabled={!comment.trim()}>
                发布评论
              </Button>
            </div>
            <div className="inspiration-comment-list">
              {comments?.list?.length ? (
                comments.list.map((item) => (
                  <div className="inspiration-comment-item" key={item.id}>
                    <Avatar
                      avatar={item.avatar}
                      size="36px"
                      alt={item.display_name || item.username}
                    />
                    <div>
                      <div className="inspiration-comment-head">
                        <strong>{item.display_name || item.username}</strong>
                        <FormatTime time={item.created_at} />
                      </div>
                      <p>{item.content}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="inspiration-empty">暂无评论</div>
              )}
            </div>
          </section>

          {data.related?.length ? (
            <section className="inspiration-detail-section">
              <h2>相关推荐</h2>
              <div className="inspiration-related-grid">
                {data.related.map((item) => (
                  <Link
                    className="inspiration-related-card"
                    to={`/inspirations/${item.id}`}
                    key={item.id}>
                    {item.cover_url ? (
                      <img src={item.cover_url} alt="" />
                    ) : (
                      <span className="inspiration-related-placeholder">
                        <i className="bi bi-stars" />
                      </span>
                    )}
                    <span className="inspiration-related-copy">
                      <small>{item.category || item.type || '灵感推荐'}</small>
                      <strong>{item.title}</strong>
                      <em>{item.summary || item.content}</em>
                    </span>
                    <i className="bi bi-chevron-right" />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </article>

        <aside className="inspiration-sidebar inspiration-detail-rail">
          <section className="inspiration-side-card">
            <div className="inspiration-side-title">
              <h2>热门标签</h2>
              <Link to="/inspirations/tags">
                全部标签 <i className="bi bi-chevron-right" />
              </Link>
            </div>
            <div className="inspiration-tag-cloud">
              {(taxonomy?.tags || []).slice(0, 8).map((item, index) => (
                <Link
                  className={`tone-${(index % 4) + 1}`}
                  key={item.name}
                  to={`/inspirations?tag=${encodeURIComponent(item.name)}`}>
                  {item.name} <span>{compactNumber(item.count)}</span>
                </Link>
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
              {(hot?.list || []).map((item, index) => (
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
              {(authors || []).slice(0, 4).map((author, index) => (
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
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <Modal show={showReport} onHide={() => setShowReport(false)}>
        <Modal.Header closeButton>
          <Modal.Title>举报灵感</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>举报原因</Form.Label>
            <Form.Control
              value={reportReason}
              onChange={(evt) => setReportReason(evt.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>补充说明</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={reportContent}
              onChange={(evt) => setReportContent(evt.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setShowReport(false)}>
            取消
          </Button>
          <Button onClick={submitReport} disabled={!reportReason.trim()}>
            提交举报
          </Button>
        </Modal.Footer>
      </Modal>
    </main>
  );
};

export default InspirationDetail;
