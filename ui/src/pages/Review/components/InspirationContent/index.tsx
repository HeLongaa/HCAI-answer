import { FC, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Stack } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { FormatTime } from '@/components';
import {
  getReviewInspirations,
  InspirationItem,
  InspirationStatus,
  reviewInspiration,
} from '@/services';
import { toastStore } from '@/stores';
import { scrollToDocTop } from '@/utils';

import '@/pages/Inspirations/index.scss';

const PAGE_SIZE = 1;

interface IProps {
  refreshCount: () => void;
  status: Extract<InspirationStatus, 'pending_review' | 'reported'>;
}

const titleByStatus: Record<IProps['status'], string> = {
  pending_review: '灵感审核',
  reported: '灵感举报',
};

const getErrorMessage = (err: any, fallback: string) =>
  err?.msg || err?.message || fallback;

const InspirationContent: FC<IProps> = ({ refreshCount, status }) => {
  const [page, setPage] = useState(1);
  const [resp, setResp] = useState<{
    count: number;
    list: InspirationItem[];
  }>();
  const [reviewComment, setReviewComment] = useState('');
  const [featured, setFeatured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const item = resp?.list?.[0] || null;

  const queryNextOne = async (pageNumber: number) => {
    try {
      const nextResp = await getReviewInspirations({
        page: pageNumber,
        page_size: PAGE_SIZE,
        status,
      });
      if (!nextResp.list.length && nextResp.count && pageNumber !== 1) {
        setPage(1);
        queryNextOne(1);
        return;
      }
      setPage(pageNumber);
      setResp(nextResp);
      setReviewComment(nextResp.list[0]?.review_comment || '');
      setFeatured(Boolean(nextResp.list[0]?.is_featured));
      setTimeout(() => {
        scrollToDocTop();
      }, 150);
    } catch (err) {
      console.error('query review inspiration error:', err);
      setResp({ count: 0, list: [] });
    }
  };

  useEffect(() => {
    queryNextOne(1);
  }, [status]);

  const submit = async (
    nextStatus: InspirationStatus,
    extra?: { revoke_reward?: boolean; ban_author?: boolean },
  ) => {
    if (!item) {
      return;
    }
    setIsLoading(true);
    try {
      await reviewInspiration({
        id: item.id,
        status: nextStatus,
        review_comment: reviewComment,
        featured,
        featured_weight: item.featured_weight || 100,
        ...extra,
      });
      toastStore.getState().show({ msg: '处理成功', variant: 'success' });
      refreshCount();
      queryNextOne(page);
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '处理失败，请稍后重试'),
        variant: 'danger',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!item) {
    return null;
  }

  return (
    <Card>
      <Card.Header>{titleByStatus[status]}</Card.Header>
      <Card.Body className="p-0">
        <Alert variant="info" className="border-0 rounded-0 mb-0">
          <Stack direction="horizontal" gap={2} className="align-items-center">
            <span>
              {item.user_display_name || item.username || item.user_id}
            </span>
            {item.created_at ? (
              <FormatTime
                time={item.created_at}
                className="small text-secondary"
                preFix="提交于"
              />
            ) : null}
          </Stack>
        </Alert>
        <div className="p-3">
          <small className="d-block text-secondary mb-3">
            <span>灵感 </span>
            <Link
              to={`/inspirations/${item.id}`}
              target="_blank"
              className="link-secondary">
              #{item.id}
            </Link>
          </small>
          <h5>{item.title}</h5>
          <p className="text-secondary">{item.summary}</p>
          <div className="small text-secondary mb-3">
            类型：{item.type || '-'} / 分类：{item.category || '-'} / 热度：
            {item.hot_score}
          </div>
          {status === 'reported' ? (
            <Alert variant="warning" className="mb-3">
              <strong>举报原因：</strong>
              {item.report_reason || '未填写'}
              {item.report_content ? (
                <div className="mt-2">{item.report_content}</div>
              ) : null}
            </Alert>
          ) : null}
          <div className="fmt text-break text-wrap mb-3">{item.content}</div>
          {item.prompt ? (
            <pre className="inspiration-prompt mb-3">{item.prompt}</pre>
          ) : null}
          <Form.Group className="mb-3">
            <Form.Label>审核说明</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={reviewComment}
              onChange={(evt) => setReviewComment(evt.target.value)}
            />
          </Form.Group>
          <Form.Check
            className="mb-3"
            type="switch"
            label="设为精选"
            checked={featured}
            onChange={(evt) => setFeatured(evt.target.checked)}
          />
          <div className="d-flex flex-wrap justify-content-between gap-2">
            <Button
              variant="outline-secondary"
              disabled={isLoading}
              onClick={() => queryNextOne(page + 1)}>
              跳过
            </Button>
            <div className="d-flex flex-wrap gap-2">
              <Button
                variant="outline-danger"
                disabled={isLoading}
                onClick={() => submit('rejected')}>
                拒绝
              </Button>
              <Button
                variant="outline-secondary"
                disabled={isLoading}
                onClick={() => submit('hidden')}>
                下架
              </Button>
              <Button
                variant="outline-danger"
                disabled={isLoading}
                onClick={() =>
                  submit('deleted', { revoke_reward: true, ban_author: false })
                }>
                删除并撤销奖励
              </Button>
              <Button
                variant="outline-danger"
                disabled={isLoading}
                onClick={() =>
                  submit('deleted', { revoke_reward: true, ban_author: true })
                }>
                删除并封禁
              </Button>
              <Button disabled={isLoading} onClick={() => submit('published')}>
                通过/恢复
              </Button>
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default InspirationContent;
