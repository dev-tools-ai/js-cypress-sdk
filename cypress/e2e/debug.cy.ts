describe('debug spec', () => {
  it('Can fill in simple forms', () => {
    const username = 'etienne+demo@dev-tools.ai';
    const password = 'demoPassword2022!';

    cy.visit('https://github.com/login');

    cy.get('[name="login"]').type(username);
    cy.get('[name="password"]').type(password);
  });
});
