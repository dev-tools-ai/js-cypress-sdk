describe('find', () => {
  it(
    'should be able to chain with a get command when not using backup mode',
    {
      retries: {
        runMode: 1,
        openMode: 0,
      },
    },
    () => {
      cy.visit('https://github.com/login');

      cy.get('[id="login"]')
        .should('be.visible')
        .find('[id="login_field"]')
        .should('be.visible');
    },
  );
  it(
    'should be able to chain with ai with a get command when not using backup mode',
    {
      retries: {
        runMode: 1,
        openMode: 2,
      },
    },
    () => {
      cy.visit('https://github.com/login');

      cy.get('[id="login"]')
        .should('be.visible')
        .find('login-field')
        .should('be.visible');
    },
  );
});
