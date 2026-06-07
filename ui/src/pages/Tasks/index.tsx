import { FC, KeyboardEvent, MouseEvent, useState } from 'react';
import { Button, Badge, Form, ListGroup, Modal } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';

import { Empty, FormatTime, Pagination } from '@/components';
import { claimTask, submitTask, TaskItem, useTasks } from '@/services';
import { loggedUserInfoStore, toastStore } from '@/stores';
import { usePageTags } from '@/hooks';
import '@/components/QuestionList/index.scss';

import './index.scss';

const PAGE_SIZE = 10;

const statusText = {
  open: '可领取',
  in_progress: '进行中',
  submitted: '待验收',
  completed: '已完成',
  failed: '已失败',
  closed: '已关闭',
  pending_review: '待审核',
  rejected: '已驳回',
};

const statusVariant = {
  open: 'success',
  closed: 'danger',
  failed: 'danger',
  rejected: 'danger',
};

const publicTaskStatuses = new Set([
  'open',
  'in_progress',
  'submitted',
  'completed',
  'failed',
  'closed',
]);

const getErrorMessage = (err: any, fallback: string) => {
  return err?.msg || err?.message || fallback;
};

const stopTaskActionPropagation = (evt: MouseEvent) => {
  evt.stopPropagation();
};

const renderTaskText = (text?: string) =>
  text?.trim() ? (
    <p className="task-square-detail-text">{text}</p>
  ) : (
    <span className="task-square-detail-empty">暂无</span>
  );

const renderTaskLinks = (items?: string[]) =>
  items?.length ? (
    <div className="task-square-detail-links">
      {items.map((item) => (
        <a href={item} target="_blank" rel="noreferrer" key={item}>
          {item}
        </a>
      ))}
    </div>
  ) : (
    <span className="task-square-detail-empty">暂无</span>
  );

const Tasks: FC = () => {
  const [params] = useSearchParams();
  const page = Number(params.get('page')) || 1;
  const mine = params.get('mine') === '1';
  const { data, mutate } = useTasks({
    page,
    page_size: PAGE_SIZE,
    mine: mine ? 'true' : undefined,
  });
  const [submitTarget, setSubmitTarget] = useState<TaskItem | null>(null);
  const [submitContent, setSubmitContent] = useState('');
  const [submitLinks, setSubmitLinks] = useState('');
  const [expandedTaskID, setExpandedTaskID] = useState<number | null>(null);
  const currentUserID = loggedUserInfoStore((state) => state.user.id);
  const tasks = mine
    ? data?.list || []
    : (data?.list || []).filter((task) => publicTaskStatuses.has(task.status));

  usePageTags({ title: '任务广场' });

  const handleClaim = async (task: TaskItem) => {
    try {
      await claimTask(task.id);
      toastStore.getState().show({ msg: '领取成功', variant: 'success' });
      mutate();
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '领取失败，请稍后重试'),
        variant: 'danger',
      });
    }
  };

  const handleSubmit = async () => {
    if (!submitTarget) {
      return;
    }
    try {
      await submitTask({
        id: submitTarget.id,
        content: submitContent,
        links: submitLinks
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      toastStore
        .getState()
        .show({ msg: '提交成功，等待验收', variant: 'success' });
      setSubmitTarget(null);
      setSubmitContent('');
      setSubmitLinks('');
      mutate();
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '提交失败，请稍后重试'),
        variant: 'danger',
      });
    }
  };

  const toggleTaskDetail = (taskID: number) => {
    setExpandedTaskID((current) => (current === taskID ? null : taskID));
  };

  const handleTaskKeyDown = (
    evt: KeyboardEvent<HTMLElement>,
    taskID: number,
  ) => {
    if (evt.key !== 'Enter' && evt.key !== ' ') {
      return;
    }
    evt.preventDefault();
    toggleTaskDetail(taskID);
  };

  return (
    <div className="task-square-page">
      <div className="task-square-head">
        <div>
          <span className="task-square-kicker">Task Square</span>
          <h1>任务广场</h1>
          <p>提交需求，领取任务，验收通过后获得积分。</p>
        </div>
        <div className="task-square-actions">
          <Button
            as={Link as any}
            to="/users/settings/points"
            variant="outline-primary">
            我的积分
          </Button>
          <Button as={Link as any} to="/tasks/new">
            提出需求
          </Button>
        </div>
      </div>

      <div className="task-square-tabs">
        <Link className={!mine ? 'active' : ''} to="/tasks">
          全部任务
        </Link>
        <Link className={mine ? 'active' : ''} to="/tasks?mine=1">
          我的任务
        </Link>
      </div>

      <div className="question-list-table-head task-square-table-head">
        <span>任务</span>
        <span>奖励</span>
        <span>状态</span>
        <span>时间</span>
      </div>

      <ListGroup className="question-list-dense question-list-view-card rounded-0 task-square-list">
        {tasks.length === 0 ? <Empty /> : null}
        {tasks.map((task) => {
          const isFeatured = task.tags.includes('精选');
          const visibleTags = task.tags.filter((tag) => tag !== '精选');
          const activityTime =
            task.deadline || task.completed_at || task.updated_at;
          const expanded = expandedTaskID === task.id;
          const canSubmit =
            task.status === 'in_progress' && task.assignee_id === currentUserID;

          return (
            <ListGroup.Item
              as="article"
              className={`question-list-row task-square-card ${
                isFeatured
                  ? 'question-list-row-featured'
                  : 'border-start-0 border-end-0'
              } ${expanded ? 'task-square-card-expanded' : ''}`}
              key={task.id}
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              onClick={() => toggleTaskDetail(task.id)}
              onKeyDown={(evt) => handleTaskKeyDown(evt, task.id)}>
              <div className="question-list-grid task-square-card-grid">
                <div className="question-list-main task-square-card-main">
                  <h5 className="question-list-title text-wrap text-break task-square-card-title">
                    <span className="question-list-title-link link-dark">
                      {isFeatured ? (
                        <span className="question-featured-badge">精选</span>
                      ) : null}
                      <span>{task.title}</span>
                    </span>
                  </h5>
                  <div className="task-square-meta">
                    <span>
                      发布人：{task.user_display_name || task.user_id}
                    </span>
                    {task.assignee_id && task.assignee_id !== '0' ? (
                      <span>
                        领取人：
                        {task.assignee_display_name || task.assignee_id}
                      </span>
                    ) : null}
                  </div>
                  {visibleTags.length > 0 ? (
                    <div className="question-tags question-list-tags task-square-tags">
                      {visibleTags.map((tag) => (
                        <span className="task-square-tag" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <span className="task-square-detail-hint">
                    {expanded ? '收起详情' : '查看详情'}
                  </span>
                </div>

                <div className="question-list-metric task-square-reward">
                  <span className="question-list-mobile-label">奖励</span>
                  <span>{task.reward_points}</span>
                </div>

                <div className="question-list-metric task-square-status">
                  <span className="question-list-mobile-label">状态</span>
                  <Badge bg={statusVariant[task.status] || 'secondary'}>
                    {statusText[task.status] || task.status}
                  </Badge>
                  <div
                    className="task-square-card-actions"
                    onClick={stopTaskActionPropagation}>
                    {task.status === 'open' ? (
                      <Button size="sm" onClick={() => handleClaim(task)}>
                        领取
                      </Button>
                    ) : null}
                    {canSubmit ? (
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => setSubmitTarget(task)}>
                        提交
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="question-list-activity task-square-activity">
                  <span className="question-list-mobile-label">时间</span>
                  {activityTime ? (
                    <FormatTime
                      time={activityTime}
                      className="text-secondary"
                    />
                  ) : (
                    <span className="text-secondary">无截止</span>
                  )}
                </div>
              </div>
              {expanded ? (
                <div className="task-square-detail-panel">
                  <div className="task-square-detail-section task-square-detail-section-wide">
                    <strong>任务详情</strong>
                    {renderTaskText(task.description)}
                  </div>
                  <div className="task-square-detail-section">
                    <strong>提交要求</strong>
                    {renderTaskText(task.submission_requirements)}
                  </div>
                  <div className="task-square-detail-section">
                    <strong>附件/链接</strong>
                    {renderTaskLinks(task.attachments)}
                  </div>
                  <div className="task-square-detail-section">
                    <strong>
                      {task.status === 'rejected' ? '拒绝理由' : '审核说明'}
                    </strong>
                    {renderTaskText(task.review_comment)}
                  </div>
                  {task.submission ? (
                    <>
                      <div className="task-square-detail-section task-square-detail-section-wide">
                        <strong>提交成果</strong>
                        {renderTaskText(task.submission.content)}
                      </div>
                      <div className="task-square-detail-section">
                        <strong>成果链接</strong>
                        {renderTaskLinks(task.submission.links)}
                      </div>
                      <div className="task-square-detail-section">
                        <strong>
                          {task.submission.status === 'rejected'
                            ? '退回理由'
                            : '验收说明'}
                        </strong>
                        {renderTaskText(task.submission.review_note)}
                      </div>
                    </>
                  ) : null}
                  <div className="task-square-detail-section task-square-detail-meta">
                    <strong>后台记录</strong>
                    <span>任务 ID：{task.id}</span>
                    <span>
                      审核人：
                      {task.reviewer_id && task.reviewer_id !== '0'
                        ? task.reviewer_id
                        : '暂无'}
                    </span>
                    {task.claimed_at ? (
                      <span>
                        领取时间：
                        <FormatTime time={task.claimed_at} />
                      </span>
                    ) : null}
                    {task.completed_at ? (
                      <span>
                        完成时间：
                        <FormatTime time={task.completed_at} />
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </ListGroup.Item>
          );
        })}
      </ListGroup>
      <Pagination
        currentPage={page}
        pageSize={PAGE_SIZE}
        totalSize={data?.count || 0}
      />

      <Modal
        show={Boolean(submitTarget)}
        onHide={() => setSubmitTarget(null)}
        centered>
        <Modal.Header closeButton>
          <Modal.Title>提交成果</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>成果说明</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              value={submitContent}
              onChange={(evt) => setSubmitContent(evt.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>相关链接，每行一个</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={submitLinks}
              onChange={(evt) => setSubmitLinks(evt.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="link" onClick={() => setSubmitTarget(null)}>
            取消
          </Button>
          <Button disabled={!submitContent.trim()} onClick={handleSubmit}>
            提交
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Tasks;
