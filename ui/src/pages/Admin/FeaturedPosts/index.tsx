import { FC, useState } from 'react';
import { Button, Form, Modal, Table } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';

import { featurePost, revokeFeaturedPost, useFeaturedPosts } from '@/services';
import { FormatTime, Pagination } from '@/components';
import { toastStore } from '@/stores';
import type { FeaturedPost } from '@/services';

const PAGE_SIZE = 20;

const getErrorMessage = (err: any, fallback: string) => {
  return err?.msg || err?.message || fallback;
};

const FeaturedPosts: FC = () => {
  const [params] = useSearchParams();
  const page = Number(params.get('page')) || 1;
  const { data, mutate } = useFeaturedPosts({ page, page_size: PAGE_SIZE });
  const [open, setOpen] = useState(false);
  const [questionID, setQuestionID] = useState('');
  const [rewardPoints, setRewardPoints] = useState(10);
  const [note, setNote] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<FeaturedPost | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await featurePost({
        question_id: questionID,
        reward_points: rewardPoints,
        note,
      });
      toastStore
        .getState()
        .show({ msg: '已精选并发放积分', variant: 'success' });
      setOpen(false);
      setQuestionID('');
      setRewardPoints(10);
      setNote('');
      mutate();
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '精选失败，请检查帖子 ID 或稍后重试'),
        variant: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = async () => {
    if (!revokeTarget) {
      return;
    }
    setSubmitting(true);
    try {
      await revokeFeaturedPost({ question_id: revokeTarget.question_id });
      toastStore
        .getState()
        .show({ msg: '已取消精选并收回积分', variant: 'success' });
      setRevokeTarget(null);
      mutate();
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '取消精选失败，请稍后重试'),
        variant: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="m-0">精选帖子</h3>
        <Button onClick={() => setOpen(true)}>新增精选</Button>
      </div>
      <Table responsive>
        <thead>
          <tr>
            <th>时间</th>
            <th>帖子</th>
            <th>作者</th>
            <th>奖励</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {data?.list?.map((item) => (
            <tr key={item.id}>
              <td>
                <FormatTime time={item.created_at} />
              </td>
              <td>
                <Link to={`/questions/${item.question_id}`}>{item.title}</Link>
              </td>
              <td>{item.author_name || item.author_id}</td>
              <td>{item.reward_points}</td>
              <td>
                {item.revoked ? '已收回' : item.active ? '精选中' : '已取消'}
              </td>
              <td>
                {item.active && !item.revoked ? (
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => setRevokeTarget(item)}>
                    取消精选
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination
        currentPage={page}
        pageSize={PAGE_SIZE}
        totalSize={data?.count || 0}
      />

      <Modal show={open} onHide={() => setOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>新增精选</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>帖子 ID</Form.Label>
            <Form.Control
              value={questionID}
              onChange={(evt) => setQuestionID(evt.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>奖励积分</Form.Label>
            <Form.Control
              type="number"
              value={rewardPoints}
              onChange={(evt) => setRewardPoints(Number(evt.target.value) || 0)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>说明</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={note}
              onChange={(evt) => setNote(evt.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="link" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            disabled={!questionID || rewardPoints <= 0 || submitting}
            onClick={submit}>
            精选并发积分
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={Boolean(revokeTarget)}
        onHide={() => setRevokeTarget(null)}
        centered>
        <Modal.Header closeButton>
          <Modal.Title>取消精选</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          确认取消精选“{revokeTarget?.title}
          ”吗？取消后会收回本次精选发放的积分。
        </Modal.Body>
        <Modal.Footer>
          <Button variant="link" onClick={() => setRevokeTarget(null)}>
            保留精选
          </Button>
          <Button variant="danger" disabled={submitting} onClick={revoke}>
            确认取消
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default FeaturedPosts;
