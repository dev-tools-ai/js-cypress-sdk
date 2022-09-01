describe('getByAI', () => {
  it(
    'should be able to get a basic element using AI using non interactive mode',
    {
      retries: {
        runMode: 1,
        openMode: 0,
      },
    },
    () => {
      cy.visit('https://github.com/login');
      cy.getByAI('[id="login"]').should('be.visible');
    },
  );
  it(
    'should be able to chain with a get command using AI',
    {
      retries: {
        runMode: 1,
        openMode: 3,
      },
    },
    () => {
      cy.visit('https://github.com/login');

      cy.getByAI('[id="login"]')
        .should('be.visible')
        .find('[id="login_field"]')
        .should('be.visible');
    },
  );
});
