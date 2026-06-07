import { FC, useState } from 'react';
import { Badge, Button, Form, Modal, Table } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';

import { FormatTime, Pagination, QueryGroup } from '@/components';
import {
  reviewTask,
  reviewTaskSubmission,
  TaskItem,
  TaskStatus,
  useAdminTasks,
} from '@/services';
import { toastStore } from '@/stores';

import './index.scss';

const PAGE_SIZE = 20;
type AdminTaskReviewStatus = 'open' | 'rejected' | 'closed' | 'failed';

const statusText: Record<TaskStatus, string> = {
  pending_review: '待审核',
  open: '已发布',
  in_progress: '进行中',
  submitted: '待验收',
  completed: '已完成',
  rejected: '已驳回',
  failed: '已失败',
  closed: '已关闭',
};
const filters = Object.entries(statusText).map(([sort, name]) => ({
  sort,
  name,
}));

const taskStatuses = new Set<TaskStatus>(
  Object.keys(statusText) as TaskStatus[],
);

const reviewStatuses = new Set<AdminTaskReviewStatus>([
  'open',
  'rejected',
  'closed',
  'failed',
]);

const parseTaskStatus = (value: string | null): TaskStatus => {
  if (value && taskStatuses.has(value as TaskStatus)) {
    return value as TaskStatus;
  }
  return 'pending_review';
};

const parseReviewStatus = (value: unknown): AdminTaskReviewStatus => {
  if (
    typeof value === 'string' &&
    reviewStatuses.has(value as AdminTaskReviewStatus)
  ) {
    return value as AdminTaskReviewStatus;
  }
  return 'open';
};

const getErrorMessage = (err: any, fallback: string) => {
  return err?.msg || err?.message || fallback;
};

const AdminTasks: FC = () => {
  const [params] = useSearchParams();
  const page = Number(params.get('page')) || 1;
  const status = parseTaskStatus(params.get('status'));
  const { data, mutate } = useAdminTasks({
    page,
    page_size: PAGE_SIZE,
    status,
  });
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [reviewingSubmission, setReviewingSubmission] =
    useState<TaskItem | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const openEdit = (task: TaskItem) => {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description,
      tags: task.tags.join(','),
      reward_points: task.reward_points || 0,
      deadline: task.deadline
        ? new Date(task.deadline * 1000).toISOString().slice(0, 16)
        : '',
      submission_requirements: task.submission_requirements,
      attachments: task.attachments.join('\n'),
      status: task.status === 'pending_review' ? 'open' : task.status,
      review_comment: task.review_comment,
    });
  };

  const saveTask = async () => {
    if (!editing) {
      return;
    }
    try {
      await reviewTask({
        id: editing.id,
        title: form.title,
        description: form.description,
        tags: String(form.tags || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        reward_points: Number(form.reward_points) || 0,
        deadline: form.deadline
          ? Math.floor(new Date(form.deadline).getTime() / 1000)
          : 0,
        submission_requirements: form.submission_requirements,
        attachments: String(form.attachments || '')
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
        status: parseReviewStatus(form.status),
        review_comment: form.review_comment,
      });
      toastStore.getState().show({ msg: '保存成功', variant: 'success' });
      setEditing(null);
      mutate();
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '保存失败，请稍后重试'),
        variant: 'danger',
      });
    }
  };

  const submitReview = async (approved: boolean) => {
    if (!reviewingSubmission) {
      toastStore.getState().show({
        msg: '未找到任务，无法验收',
        variant: 'danger',
      });
      return;
    }
    try {
      await reviewTaskSubmission({
        submission_id: reviewingSubmission.submission?.id,
        task_id: reviewingSubmission.id,
        approved,
        review_note: reviewNote,
      });
      toastStore.getState().show({
        msg: approved ? '验收通过，积分已发放' : '已退回修改',
        variant: 'success',
      });
      setReviewingSubmission(null);
      setReviewNote('');
      mutate();
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '验收失败，请稍后重试'),
        variant: 'danger',
      });
    }
  };

  return (
    <>
      <h3 className="mb-4">任务管理</h3>
      <div className="mb-3">
        <QueryGroup
          data={filters}
          currentSort={status}
          sortKey="status"
          i18nKeyPrefix=""
          maxBtnCount={filters.length}
          wrapClassName="admin-task-status-tabs"
        />
      </div>
      <Table responsive>
        <thead>
          <tr>
            <th>任务</th>
            <th>状态</th>
            <th>奖励</th>
            <th>截止时间</th>
            <th>发布/领取</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data?.list?.map((task) => (
            <tr key={task.id}>
              <td>
                <strong>{task.title}</strong>
                <div className="text-secondary small">{task.description}</div>
              </td>
              <td>
                <Badge bg="secondary">
                  {statusText[task.status] || task.status}
                </Badge>
              </td>
              <td>{task.reward_points}</td>
              <td>
                {task.deadline ? <FormatTime time={task.deadline} /> : '-'}
              </td>
              <td>
                <div className="small">
                  发布：{task.user_display_name || task.user_id}
                </div>
                <div className="small">
                  领取：{task.assignee_display_name || task.assignee_id || '-'}
                </div>
              </td>
              <td className="text-end">
                {task.status === 'submitted' ? (
                  <Button
                    size="sm"
                    onClick={() => setReviewingSubmission(task)}>
                    验收
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => openEdit(task)}>
                    编辑/审核
                  </Button>
                )}
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

      <Modal show={Boolean(editing)} onHide={() => setEditing(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>编辑/审核任务</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label>标题</Form.Label>
            <Form.Control
              value={form.title || ''}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>描述</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={form.description || ''}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>标签，英文逗号分隔</Form.Label>
            <Form.Control
              value={form.tags || ''}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>奖励积分</Form.Label>
            <Form.Control
              type="number"
              value={form.reward_points || 0}
              onChange={(e) =>
                setForm({ ...form, reward_points: e.target.value })
              }
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>截止时间</Form.Label>
            <Form.Control
              type="datetime-local"
              value={form.deadline || ''}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>提交要求</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={form.submission_requirements || ''}
              onChange={(e) =>
                setForm({ ...form, submission_requirements: e.target.value })
              }
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>附件/链接，每行一个</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={form.attachments || ''}
              onChange={(e) =>
                setForm({ ...form, attachments: e.target.value })
              }
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>状态</Form.Label>
            <Form.Select
              value={form.status || 'open'}
              onChange={(e) =>
                setForm({ ...form, status: parseReviewStatus(e.target.value) })
              }>
              <option value="open">发布</option>
              <option value="rejected">驳回</option>
              <option value="closed">关闭</option>
              <option value="failed">失败</option>
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>审核说明</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={form.review_comment || ''}
              onChange={(e) =>
                setForm({ ...form, review_comment: e.target.value })
              }
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="link" onClick={() => setEditing(null)}>
            取消
          </Button>
          <Button onClick={saveTask}>保存</Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={Boolean(reviewingSubmission)}
        onHide={() => setReviewingSubmission(null)}>
        <Modal.Header closeButton>
          <Modal.Title>验收任务成果</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <strong>{reviewingSubmission?.title}</strong>
            <p className="mt-2 mb-0">
              {reviewingSubmission?.submission?.content || '暂无提交内容'}
            </p>
            {!reviewingSubmission?.submission ? (
              <div className="text-secondary small mt-2">
                当前任务没有提交记录，将按任务状态直接验收。
              </div>
            ) : null}
          </div>
          {reviewingSubmission?.submission?.links?.length ? (
            <div className="mb-3">
              <div className="text-secondary small mb-1">提交链接</div>
              {reviewingSubmission.submission.links.map((link) => (
                <a
                  className="d-block text-break"
                  href={link}
                  key={link}
                  target="_blank"
                  rel="noreferrer">
                  {link}
                </a>
              ))}
            </div>
          ) : null}
          <Form.Group>
            <Form.Label>验收说明</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-danger"
            disabled={!reviewingSubmission}
            onClick={() => submitReview(false)}>
            不通过
          </Button>
          <Button
            disabled={!reviewingSubmission}
            onClick={() => submitReview(true)}>
            通过并发积分
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default AdminTasks;
