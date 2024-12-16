import './scss/styles.scss';
import './scss/styles.scss';
import { ensureElement, cloneTemplate } from './utils/utils';
import {
	IOrder,
	IProductItem,
	IDelivery,
	IContact,
	ICardActions,
} from './types';
import { API_URL, CDN_URL } from './utils/constants';
import { AppApi } from './components/web';
import { CatalogChangeEvent } from './components/appData';
import { EventEmitter } from './components/base/events';
import { Card } from './components/card';
import { Page } from './components/page';
import { AppState } from './components/appData';
import { Order, Contact } from './components/order';
import { Modal } from './components/modal';
import { Basket } from './components/basket';
import { Success } from './components/succes';

class App {
	private api: AppApi;
	private events: EventEmitter;
	private page: Page;
	private modal: Modal;
	private appData: AppState;
	private basket: Basket;
	private order: Order;
	private contacts: Contact;
	private successModal: Success;

	constructor() {
		this.api = new AppApi(CDN_URL, API_URL);
		this.events = new EventEmitter();
		this.page = new Page(document.body, this.events);
		this.modal = new Modal(
			ensureElement<HTMLElement>('#modal-container'),
			this.events
		);
		this.appData = new AppState({}, this.events);
		this.basket = new Basket(
			cloneTemplate(ensureElement<HTMLTemplateElement>('#basket-template')),
			this.events
		);
		this.order = new Order(
			cloneTemplate(ensureElement<HTMLTemplateElement>('#order-form-template')),
			this.events
		);
		this.contacts = new Contact(
			cloneTemplate(
				ensureElement<HTMLTemplateElement>('#contact-form-template')
			),
			this.events
		);

		this.successModal = new Success(
			cloneTemplate(ensureElement<HTMLTemplateElement>('#success-template')),
			{
				onClick: () => {
					this.modal.close();
					this.appData.orderReset();
					this.appData.contactReset();
				},
			}
		);

		this.initEvents();
		this.loadData();
	}

	private initEvents() {
		this.events.onAll(({ eventName, data }) => console.log(eventName, data));
		this.events.on<CatalogChangeEvent>('items:changed', () =>
			this.updateCatalog()
		);

	this.events.on('basket:change', () => {
    this.updateBasket();
    this.updateBasketCounter(); 
    this.appData.basket.forEach((id) => this.updateCard(id));
});

		this.events.onAll(({ eventName, data }) => console.log(eventName, data));
		this.events.on<CatalogChangeEvent>('items:changed', () =>
			this.updateCatalog()
		);
		this.events.on('card:select', (item: IProductItem) => this.openCard(item));
		this.events.on('card:toBasket', (item: IProductItem) =>
			this.toggleBasketItem(item)
		);
		this.events.on('basket:open', () => this.openBasket());
		this.events.on('basket:change', () => this.updateBasket());
		this.events.on('order:open', () => this.openOrder());
		this.events.on('order:submit', () => this.openContacts());
		this.events.on('orderformErrors:change', (errors: Partial<IOrder>) =>
			this.validateOrder(errors)
		);
		this.events.on('contactsformErrors:change', (errors: Partial<IContact>) =>
			this.validateContacts(errors)
		);
		this.events.on(
			/^order\..*:change/,
			(data: { field: keyof IDelivery; value: string }) =>
				this.updateOrderField(data)
		);
		this.events.on(
			/^contacts\..*:change/,
			(data: { field: keyof IContact; value: string }) =>
				this.updateContactField(data)
		);
		this.events.on('contacts:submit', () => this.submitOrder());
		this.events.on('modal:open', () => (this.page.locked = true));
		this.events.on('modal:close', () => (this.page.locked = false));
	}

	private loadData() {
		this.api
			.getProductList()
			.then((products) => {
				this.appData.setCatalog(products);
				this.updateCatalog();
			})
			.catch((error) => {
				console.error('Error loading product list:', error);
			});
	}

	private updateBasketCounter() {
		const count = this.appData.basket.length;
		this.page.counter = count; 
	}

	private updateCatalog() {
		this.page.catalog = this.appData.catalog.map((item) => {
			const isInBasket = this.appData.basket.includes(item.id);
			const card = new Card(
				cloneTemplate(
					ensureElement<HTMLTemplateElement>('#card-catalog-template')
				),
				item,
				{
					onClick: () => this.events.emit('card:select', item),
					onAddToBasket: () => {
						this.appData.addBasket(item.id);
						this.events.emit('basket:change');
					},
					onRemoveFromBasket: () => {
						this.appData.removeBasket(item.id);
						this.events.emit('basket:change');
					},
				}
			);
			card.updateButton(isInBasket);
			card.category = item.category; 
			return card.getContainer();
		});
	}
	

	private openCard(item: IProductItem) {
		const updateButtonText = () => {
			const isInBasket = this.appData.basket.includes(item.id);
			card.updateButton(isInBasket);
		};

		const card = new Card(
			cloneTemplate(
				ensureElement<HTMLTemplateElement>('#card-preview-template')
			),
			item,
			{
				onClick: () => {},
				onAddToBasket: (item) => {
					this.appData.addBasket(item.id);
					updateButtonText();
					this.events.emit('basket:change');
					this.modal.close();
				},
				onRemoveFromBasket: (item) => {
					this.appData.removeBasket(item.id);
					updateButtonText();
					this.events.emit('basket:change');
					this.modal.close();
				},
			}
		);

		updateButtonText();

		this.modal.render({
			content: card.getContainer(),
		});
	}

	private toggleBasketItem(item: IProductItem) {
		if (this.appData.basket.includes(item.id)) {
			this.appData.removeBasket(item.id);
		} else {
			this.appData.addBasket(item.id);
		}
		this.events.emit('basket:change');
	}
	private openBasket() {
		this.modal.render({
			content: this.basket.getContainer(),
		});
		this.modal.open();
	}

	private createBasketItem(product: IProductItem): HTMLElement {
		const card = new Card(
			cloneTemplate(
				ensureElement<HTMLTemplateElement>('#card-basket-template')
			),
			product,
			{
				onRemoveFromBasket: () => {
					this.appData.removeBasket(product.id);
					this.events.emit('basket:change');
				},
			}
		);

		return card.getContainer();
	}

	private updateBasket() {
		const basketProducts = this.appData.getBasketProducts();
		const items = basketProducts.map((item) => this.createBasketItem(item));
	
		this.basket.render({
			items,
			price: this.appData.getTotal(),
		});
	}
	

	private updateCard(itemId: string) {
		const catalogCard = document.querySelector(`[data-id="${itemId}"]`);
		if (catalogCard) {
			const button = catalogCard.querySelector<HTMLButtonElement>('.card__button');
			const isInBasket = this.appData.basket.includes(itemId);
	
			if (button) {
				button.textContent = isInBasket ? 'Удалить из корзины' : 'Добавить в корзину';
			}
		}
	}

	private openOrder() {
		this.modal.render({
			content: this.order.render({
				payment: '',
				address: '',
				valid: false,
				errors: {},
			}),
		});
	}

	private openContacts() {
		this.modal.render({
			content: this.contacts.render({
				phone: '',
				email: '',
				valid: false,
				errors: {},
			}),
		});
	}
	private validateOrder(errors: Partial<IOrder>) {
		this.order.updateErrors(errors);
	}

	private validateContacts(errors: Partial<IContact>) {
		this.contacts.updateErrors(errors);
	}

	private updateOrderField({
		field,
		value,
	}: {
		field: keyof IDelivery;
		value: string;
	}) {
		this.appData.setOrderField(field, value);
	}

	private updateContactField({
		field,
		value,
	}: {
		field: keyof IContact;
		value: string;
	}) {
		this.appData.setContactField(field, value);
	}

	private submitOrder() {
		const { payment } = this.appData.order;

		if (!payment) {
			this.order.updateErrors({
				payment: 'Пожалуйста, выберите способ оплаты',
			});
			return;
		}

		this.api
			.order({
				...this.appData.order,
				total: this.appData.getTotal(),
				items: this.appData.basket,
			})
			.then((res) => {
				this.modal.render({
					content: this.successModal.render({
						total: res.total,
					}),
				});

				this.appData.clearBasket();
				this.events.emit('basket:change');
			})
			.catch(console.error);
	}
}

new App();
