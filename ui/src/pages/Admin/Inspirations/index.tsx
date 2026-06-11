import { FC, useState } from 'react';
import { Badge, Button, Form, Modal, Table } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';

import { FormatTime, Pagination, QueryGroup } from '@/components';
import {
  adminBanInspirationAuthor,
  adminUpdateInspiration,
  InspirationItem,
  InspirationSetting,
  InspirationStatus,
  saveInspirationSetting,
  useAdminInspirations,
  useInspirationSetting,
} from '@/services';
import { toastStore } from '@/stores';

import '@/pages/Inspirations/index.scss';

const PAGE_SIZE = 20;

const statusText: Record<InspirationStatus, string> = {
  published: '已发布',
  pending_review: '待审核',
  rejected: '已拒绝',
  hidden: '已下架',
  deleted: '已删除',
  reported: '被举报',
};

const filters = Object.entries(statusText).map(([sort, name]) => ({
  sort,
  name,
}));

const getErrorMessage = (err: any, fallback: string) =>
  err?.msg || err?.message || fallback;

const parseSettingList = (value: string) =>
  value
    .split(/\n|,|，/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseStatus = (value: string | null): InspirationStatus | undefined => {
  if (value && value in statusText) {
    return value as InspirationStatus;
  }
  return undefined;
};

const AdminInspirations: FC = () => {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page')) || 1;
  const status = parseStatus(params.get('status'));
  const query = params.get('q') || '';
  const { data, mutate } = useAdminInspirations({
    page,
    page_size: PAGE_SIZE,
    status,
    q: query || undefined,
  });
  const { data: setting, mutate: mutateSetting } = useInspirationSetting();
  const [editing, setEditing] = useState<InspirationItem | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [featured, setFeatured] = useState(false);
  const [featuredWeight, setFeaturedWeight] = useState(100);
  const [settingDraft, setSettingDraft] = useState<InspirationSetting | null>(
    null,
  );
  const [settingCategoriesDraft, setSettingCategoriesDraft] = useState('');
  const [draftQuery, setDraftQuery] = useState(query);
  const [deleting, setDeleting] = useState<InspirationItem | null>(null);
  const [deleteRevokeReward, setDeleteRevokeReward] = useState(true);
  const [deleteBanAuthor, setDeleteBanAuthor] = useState(false);

  const openEdit = (item: InspirationItem) => {
    setEditing(item);
    setReviewComment(item.review_comment || '');
    setFeatured(item.is_featured);
    setFeaturedWeight(item.featured_weight || 100);
  };

  const saveAction = async (nextStatus?: InspirationStatus) => {
    if (!editing) {
      return;
    }
    try {
      await adminUpdateInspiration(editing.id, {
        status: nextStatus || editing.status,
        review_comment: reviewComment,
        featured,
        featured_weight: featuredWeight,
        revoke_reward: nextStatus === 'deleted',
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

  const openDelete = (item: InspirationItem) => {
    setDeleting(item);
    setDeleteRevokeReward(!item.reward_revoked);
    setDeleteBanAuthor(false);
  };

  const deleteItem = async () => {
    if (!deleting) {
      return;
    }
    try {
      await adminUpdateInspiration(deleting.id, {
        status: 'deleted',
        review_comment: reviewComment,
        featured: deleting.is_featured,
        featured_weight: deleting.featured_weight,
        revoke_reward: deleteRevokeReward,
        ban_author: deleteBanAuthor,
      });
      toastStore.getState().show({
        msg: deleteBanAuthor ? '已删除并封禁作者' : '已删除',
        variant: 'success',
      });
      setDeleting(null);
      mutate();
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '删除失败'),
        variant: 'danger',
      });
    }
  };

  const banAuthor = async (item: InspirationItem) => {
    try {
      await adminBanInspirationAuthor(item.id);
      toastStore.getState().show({ msg: '已封禁作者', variant: 'success' });
      mutate();
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '封禁失败'),
        variant: 'danger',
      });
    }
  };

  const openSetting = () => {
    if (setting) {
      setSettingDraft(setting);
      setSettingCategoriesDraft((setting.categories || []).join('\n'));
    }
  };

  const saveSetting = async () => {
    if (!settingDraft) {
      return;
    }
    try {
      await saveInspirationSetting({
        ...settingDraft,
        categories: parseSettingList(settingCategoriesDraft),
      });
      toastStore.getState().show({ msg: '设置已保存', variant: 'success' });
      setSettingDraft(null);
      mutateSetting();
    } catch (err: any) {
      toastStore.getState().show({
        msg: getErrorMessage(err, '保存设置失败'),
        variant: 'danger',
      });
    }
  };

  const search = () => {
    const next = new URLSearchParams(params);
    next.delete('page');
    if (draftQuery.trim()) {
      next.set('q', draftQuery.trim());
    } else {
      next.delete('q');
    }
    setParams(next);
  };

  return (
    <div className="inspiration-admin-card">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h3 className="mb-1">灵感库管理</h3>
          <p className="text-secondary mb-0">
            管理用户发布的灵感内容、精选、下架、删除和作者封禁。
          </p>
        </div>
        <Button variant="outline-primary" onClick={openSetting}>
          奖励/审核设置
        </Button>
      </div>
      <div className="mb-3">
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Form.Control
            className="w-auto flex-grow-1"
            value={draftQuery}
            placeholder="搜索标题、作者、标签"
            onChange={(evt) => setDraftQuery(evt.target.value)}
            onKeyDown={(evt) => {
              if (evt.key === 'Enter') {
                search();
              }
            }}
          />
          <Button variant="outline-primary" onClick={search}>
            搜索
          </Button>
        </div>
        <QueryGroup
          data={filters}
          currentSort={status || ''}
          sortKey="status"
          i18nKeyPrefix=""
          maxBtnCount={filters.length}
        />
      </div>
      <Table responsive className="inspiration-admin-table">
        <thead>
          <tr>
            <th>内容</th>
            <th>作者</th>
            <th>状态</th>
            <th>数据</th>
            <th>时间</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data?.list?.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.title}</strong>
                <div className="text-secondary small">{item.summary}</div>
                {item.is_featured ? <Badge bg="primary">精选</Badge> : null}
              </td>
              <td>{item.user_display_name || item.username || item.user_id}</td>
              <td>
                <Badge
                  bg={item.status === 'published' ? 'success' : 'secondary'}>
                  {statusText[item.status] || item.status}
                </Badge>
              </td>
              <td className="small">
                <div>浏览 {item.view_count}</div>
                <div>
                  赞 {item.like_count} / 藏 {item.favorite_count} / 评{' '}
                  {item.comment_count}
                </div>
                <div>
                  奖励：{item.reward_granted ? '已发放' : '未发放'}
                  {item.reward_revoked ? ' / 已撤销' : ''}
                </div>
                {item.reward_logs?.length ? (
                  <div>流水 {item.reward_logs.length} 条</div>
                ) : null}
              </td>
              <td>
                {item.created_at ? <FormatTime time={item.created_at} /> : '-'}
              </td>
              <td className="text-end">
                <div className="d-flex flex-wrap justify-content-end gap-2">
                  <Button
                    size="sm"
                    as={Link as any}
                    to={`/inspirations/${item.id}`}
                    target="_blank"
                    variant="outline-secondary">
                    详情
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => openEdit(item)}>
                    管理
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => openDelete(item)}>
                    删除
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => banAuthor(item)}>
                    封禁
                  </Button>
                </div>
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

      <Modal show={Boolean(editing)} onHide={() => setEditing(null)}>
        <Modal.Header closeButton>
          <Modal.Title>管理灵感</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>审核/管理说明</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={reviewComment}
              onChange={(evt) => setReviewComment(evt.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Check
              type="switch"
              label="设为精选"
              checked={featured}
              onChange={(evt) => setFeatured(evt.target.checked)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>精选权重</Form.Label>
            <Form.Control
              type="number"
              min={0}
              value={featuredWeight}
              onChange={(evt) =>
                setFeaturedWeight(Math.max(0, Number(evt.target.value) || 0))
              }
            />
          </Form.Group>
          {editing?.reward_logs?.length ? (
            <div className="small">
              <div className="fw-semibold mb-2">积分奖励记录</div>
              <Table size="sm" responsive>
                <thead>
                  <tr>
                    <th>类型</th>
                    <th>变动</th>
                    <th>余额</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {editing.reward_logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.source_type}</td>
                      <td>{log.delta > 0 ? `+${log.delta}` : log.delta}</td>
                      <td>{log.balance}</td>
                      <td>{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="small text-secondary">暂无积分奖励记录</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => saveAction('hidden')}>
            下架
          </Button>
          <Button
            variant="outline-danger"
            onClick={() => saveAction('rejected')}>
            拒绝
          </Button>
          <Button onClick={() => saveAction('published')}>发布/恢复</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(deleting)} onHide={() => setDeleting(null)}>
        <Modal.Header closeButton>
          <Modal.Title>删除灵感</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-3">
            确认删除「{deleting?.title}」？删除后普通用户将不可见。
          </p>
          <Form.Check
            className="mb-3"
            type="switch"
            label="删除时撤销该灵感的发布奖励积分"
            checked={deleteRevokeReward}
            disabled={Boolean(deleting?.reward_revoked)}
            onChange={(evt) => setDeleteRevokeReward(evt.target.checked)}
          />
          <Form.Check
            type="switch"
            label="同时封禁作者"
            checked={deleteBanAuthor}
            onChange={(evt) => setDeleteBanAuthor(evt.target.checked)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeleting(null)}>
            取消
          </Button>
          <Button variant="danger" onClick={deleteItem}>
            确认删除
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(settingDraft)} onHide={() => setSettingDraft(null)}>
        <Modal.Header closeButton>
          <Modal.Title>灵感库设置</Modal.Title>
        </Modal.Header>
        {settingDraft ? (
          <Modal.Body>
            <Form.Check
              className="mb-3"
              type="switch"
              label="发布需要审核"
              checked={settingDraft.require_review}
              onChange={(evt) =>
                setSettingDraft({
                  ...settingDraft,
                  require_review: evt.target.checked,
                })
              }
            />
            <Form.Check
              className="mb-3"
              type="switch"
              label="启用发布奖励"
              checked={settingDraft.publish_reward_enabled}
              onChange={(evt) =>
                setSettingDraft({
                  ...settingDraft,
                  publish_reward_enabled: evt.target.checked,
                })
              }
            />
            <Form.Group className="mb-3">
              <Form.Label>发布奖励积分</Form.Label>
              <Form.Control
                type="number"
                min={0}
                value={settingDraft.publish_reward_points}
                onChange={(evt) =>
                  setSettingDraft({
                    ...settingDraft,
                    publish_reward_points: Math.max(
                      0,
                      Number(evt.target.value) || 0,
                    ),
                  })
                }
              />
            </Form.Group>
            <Form.Check
              className="mb-3"
              type="switch"
              label="审核通过后再奖励"
              checked={settingDraft.reward_after_review}
              onChange={(evt) =>
                setSettingDraft({
                  ...settingDraft,
                  reward_after_review: evt.target.checked,
                })
              }
            />
            <Form.Check
              type="switch"
              label="删除内容时撤销奖励"
              checked={settingDraft.revoke_reward_on_delete}
              onChange={(evt) =>
                setSettingDraft({
                  ...settingDraft,
                  revoke_reward_on_delete: evt.target.checked,
                })
              }
            />
            <div className="inspiration-form-grid mt-3">
              <Form.Group className="mb-3">
                <Form.Label>推荐热度权重</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  value={settingDraft.recommendation_hot_weight}
                  onChange={(evt) =>
                    setSettingDraft({
                      ...settingDraft,
                      recommendation_hot_weight: Math.max(
                        1,
                        Number(evt.target.value) || 1,
                      ),
                    })
                  }
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>推荐新鲜度权重</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  value={settingDraft.recommendation_fresh_weight}
                  onChange={(evt) =>
                    setSettingDraft({
                      ...settingDraft,
                      recommendation_fresh_weight: Math.max(
                        1,
                        Number(evt.target.value) || 1,
                      ),
                    })
                  }
                />
              </Form.Group>
            </div>
            <Form.Group className="mb-3">
              <Form.Label>发布分类</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={settingCategoriesDraft}
                placeholder="每行一个分类，例如：Chat 提示词"
                onChange={(evt) => setSettingCategoriesDraft(evt.target.value)}
              />
              <Form.Text className="text-secondary">
                用户发布灵感时只能从这些分类中选择。
              </Form.Text>
            </Form.Group>
          </Modal.Body>
        ) : null}
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setSettingDraft(null)}>
            取消
          </Button>
          <Button onClick={saveSetting}>保存</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminInspirations;
