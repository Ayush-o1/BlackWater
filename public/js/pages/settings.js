import { api, getAll } from '../api.js';
import { clearSession, getSession, isAdmin, requireSession, updateSessionUser } from '../auth.js';
import { h, render } from '../dom.js';
import { subscribe } from '../realtime.js';
import { renderShell, roleLabel, updateShellIdentity } from '../shell.js';
import {
  avatar, busy, button, confirmDialog, errorState, formatDate, formDialog, loadingRows, openDialog,
  selectField, setTitle, textField, toast, toastError,
} from '../ui.js';

async function start() {
  setTitle('Settings');
  const main = renderShell({ active: 'settings' });
  const { user } = getSession();
  const admin = isAdmin(user);

  const profileHost = h('section', { class: 'panel' });
  const organizationHost = h('section', { class: 'panel' });
  const teamHost = h('section', { class: 'panel' });
  const dangerHost = h('section', { class: 'panel panel-danger' });

  // The panels go in together once their data is here, so nothing moves as they fill in.
  const content = h('div', { class: 'stack page-narrow-content' }, h('div', { class: 'panel' }, loadingRows(3)));

  render(
    main,
    h('div', { class: 'page-header' }, h('div', {}, h('h1', {}, 'Settings'), h('p', {}, 'Your profile, your organization and your team.'))),
    content
  );

  // ---------- Profile ----------

  function paintProfile(me) {
    const name = h('input', { class: 'input', name: 'name', value: me.name, required: true, minlength: 2, maxlength: 100, 'aria-label': 'Your name' });
    const save = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save');
    const form = h(
      'form',
      { class: 'form' },
      h('div', { class: 'field' }, h('label', {}, 'Name'), name),
      h('div', { class: 'field' }, h('label', {}, 'Email'), h('input', { class: 'input', value: me.email, readonly: true, 'aria-label': 'Email' }), h('span', { class: 'hint' }, 'Your email is your sign-in and cannot be changed here.')),
      h('div', { class: 'form-actions' }, save)
    );
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await busy(save, async () => {
        const { data } = await api.patch('/users/me', { name: name.value });
        updateSessionUser(data);
        updateShellIdentity({ userName: data.name }); // the sidebar shows it too
        toast('Profile saved');
      });
    });

    render(
      profileHost,
      h('div', { class: 'panel-header' }, h('div', {}, h('h2', {}, 'Profile'), h('p', {}, `Signed in as ${roleLabel(me.role)}`))),
      h('div', { class: 'panel-body' }, h('div', { class: 'cluster profile-head' }, avatar(me.name, true), h('div', {}, h('strong', {}, me.name), h('div', { class: 'muted' }, me.email))), form)
    );
  }

  // ---------- Organization ----------

  function paintOrganization(organization) {
    const name = h('input', { class: 'input', name: 'name', value: organization.name, required: true, minlength: 2, maxlength: 200, readonly: !admin, 'aria-label': 'Organization name' });
    const save = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save');
    const form = h(
      'form',
      { class: 'form' },
      h('div', { class: 'field' }, h('label', {}, 'Name'), name, !admin && h('span', { class: 'hint' }, 'Only an administrator can rename the organization.')),
      admin && h('div', { class: 'form-actions' }, save)
    );
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await busy(save, async () => {
        const { data } = await api.patch('/organizations/me', { name: name.value });
        updateShellIdentity({ orgName: data.name });
        toast('Organization saved');
      });
    });

    render(
      organizationHost,
      h('div', { class: 'panel-header' }, h('div', {}, h('h2', {}, 'Organization'), h('p', {}, `${organization._count.users} ${organization._count.users === 1 ? 'member' : 'members'}`))),
      h('div', { class: 'panel-body' }, form)
    );
  }

  // ---------- Delete organization ----------

  // Irreversible, so it asks for the exact name and the administrator's password
  // (the server checks both). Afterwards nothing of the account exists to sign in to.
  function paintDanger(organization) {
    const open = () =>
      formDialog({
        title: 'Delete this organization?',
        submitLabel: 'Delete organization permanently',
        danger: true,
        fields: [
          h('p', {}, `This permanently deletes ${organization.name} with its services, incidents, history, invitations and every member's account. It cannot be undone.`),
          textField({ name: 'confirmName', label: `Type the organization name (${organization.name}) to confirm`, required: true, autocomplete: 'off' }),
          textField({ name: 'password', label: 'Your password', type: 'password', required: true, autocomplete: 'current-password' }),
        ],
        async onSubmit(values) {
          await api.delete('/organizations/me', { confirmName: values.confirmName, password: values.password });
          clearSession();
          location.replace('/login?deleted=1');
        },
      });

    render(
      dangerHost,
      h('div', { class: 'panel-header' }, h('div', {}, h('h2', {}, 'Delete organization'), h('p', {}, 'Permanently removes everything this organization owns.'))),
      h('div', { class: 'panel-body' }, button('Delete organization', { variant: 'danger', iconName: 'trash', onClick: open }))
    );
  }

  // ---------- Team ----------

  async function paintTeam() {
    const [members, invitations] = await Promise.all([getAll('/users'), admin ? api.get('/invitations').then((r) => r.data) : []]);

    const memberRow = (member) => {
      const you = member.id === user.id;
      const roleControl = admin
        ? h(
            'select',
            { class: 'select select-sm role-select', 'aria-label': `Role of ${member.name}` },
            ['ADMIN', 'MEMBER', 'VIEWER'].map((role) => h('option', { value: role }, roleLabel(role)))
          )
        : h('span', { class: member.role === 'ADMIN' ? 'badge visibility-public' : 'badge' }, roleLabel(member.role));

      if (admin) {
        roleControl.value = member.role;
        roleControl.addEventListener('change', async () => {
          try {
            await api.patch(`/users/${member.id}/role`, { role: roleControl.value });
            toast(`${member.name} is now ${roleLabel(roleControl.value)}`);
            if (you) location.reload(); // your own permissions just changed
          } catch (error) {
            toastError(error);
            roleControl.value = member.role; // the server refused; show the truth
          }
        });
      }

      return h(
        'div',
        { class: 'row' },
        h('div', { class: 'cluster' }, avatar(member.name), h('div', {}, h('div', { class: 'row-title' }, member.name, you && h('span', { class: 'subtle' }, ' (you)')), h('div', { class: 'row-meta' }, h('span', {}, member.email), h('span', {}, `Joined ${formatDate(member.createdAt)}`)))),
        h('div', { class: 'row-side' }, roleControl)
      );
    };

    const invitationRow = (invitation) => {
      const revoke = button('Revoke', {
        variant: 'ghost',
        size: 'sm',
        async onClick(trigger) {
          const confirmed = await confirmDialog({ title: 'Revoke this invitation?', message: 'The link stops working immediately.', confirmLabel: 'Revoke', danger: true });
          if (!confirmed) return;
          await busy(trigger, async () => {
            await api.delete(`/invitations/${invitation.id}`);
            toast('Invitation revoked');
            await paintTeam();
          });
        },
      });
      return h(
        'div',
        { class: 'row' },
        h('div', {}, h('div', { class: 'row-title' }, `${roleLabel(invitation.role)} invitation`), h('div', { class: 'row-meta' }, h('span', {}, `Expires ${formatDate(invitation.expiresAt)}`), invitation.createdBy && h('span', {}, `Created by ${invitation.createdBy.name}`))),
        h('div', { class: 'row-side' }, revoke)
      );
    };

    render(
      teamHost,
      h('div', { class: 'panel-header' }, h('div', {}, h('h2', {}, 'Team'), h('p', {}, admin ? 'Invite people and choose what they can do.' : 'People in your organization.')), admin && button('Invite someone', { variant: 'primary', size: 'sm', iconName: 'userPlus', onClick: () => inviteDialog(paintTeam) })),
      h('div', { class: 'rows' }, members.map(memberRow)),
      admin &&
        h(
          'div',
          { class: 'invitations' },
          h('div', { class: 'panel-header subsection' }, h('h3', {}, 'Pending invitations')),
          invitations.length === 0 ? h('p', { class: 'panel-body muted small' }, 'No pending invitations.') : h('div', { class: 'rows' }, invitations.map(invitationRow))
        )
    );
  }

  // The link is shown once, right after it is created: the server keeps only a hash.
  function inviteDialog(onDone) {
    const body = h('div');
    const dialog = openDialog({ title: 'Invite someone', content: body });

    const role = selectField({
      name: 'role',
      label: 'Role',
      options: [
        { value: 'MEMBER', label: 'Member: can declare and manage incidents and services' },
        { value: 'VIEWER', label: 'Viewer: read-only access' },
      ],
      value: 'MEMBER',
      hint: 'You can change this later. Invitations cannot create administrators.',
    });
    const create = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Create invitation link');
    const form = h('form', { class: 'form' }, role, h('div', { class: 'form-actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dialog.close() }, 'Cancel'), create));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await busy(create, async () => {
        const { data } = await api.post('/invitations', { role: role.querySelector('select').value });
        showLink(`${location.origin}/invite#${data.token}`, data);
        onDone();
      });
    });

    function showLink(url, invitation) {
      const field = h('input', { class: 'input', readonly: true, value: url, 'aria-label': 'Invitation link' });
      const copy = button('Copy', {
        iconName: 'copy',
        async onClick() {
          try {
            await navigator.clipboard.writeText(url);
            toast('Link copied');
          } catch {
            field.select();
            toast('Press Ctrl/Cmd+C to copy', 'error');
          }
        },
      });
      render(
        body,
        h(
          'div',
          { class: 'stack-sm' },
          h('p', {}, `Share this link with the person you want to invite as ${roleLabel(invitation.role)}.`),
          h('div', { class: 'copy-box' }, field, copy),
          h('p', { class: 'notice' }, `It works once and expires on ${formatDate(invitation.expiresAt)}. It will not be shown again, so copy it now.`),
          h('div', { class: 'form-actions' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => dialog.close() }, 'Done'))
        )
      );
      field.select();
    }

    render(body, form);
  }

  // ---------- Load ----------

  try {
    const [{ data: me }, { data: organization }] = await Promise.all([api.get('/users/me'), api.get('/organizations/me'), paintTeam()]);
    paintProfile(me);
    paintOrganization(organization);
    if (admin) paintDanger(organization);
    render(content, profileHost, organizationHost, teamHost, admin && dangerHost);
  } catch (error) {
    render(content, h('div', { class: 'panel' }, errorState(error, () => location.reload())));
  }

  // Someone joined or had their role changed.
  subscribe(['team:changed'], () => paintTeam().catch(() => {}));
}

if (requireSession()) start();
