describe('get command', () => {
  it(
    'should find a dom node that exists and ingest it',
    {
      retries: {
        runMode: 1,
        openMode: 0,
      },
    },
    () => {
      cy.visit('https://github.com/login');
      cy.get('[name="password').type('mytestusername@email.com');
    },
  ),
    it(
      'should find a node that does not exist using the smartdriver api',
      {
        retries: {
          runMode: 1,
          openMode: 4,
        },
      },
      () => {
        cy.visit('https://github.com/login');

        cy.get('auth-form-body mt-3')
          .should('be.visible')
          .contains('Username or email address');
      },
    );
});
