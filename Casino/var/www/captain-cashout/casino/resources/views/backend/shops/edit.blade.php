@extends('backend.layouts.app')

@section('page-title', trans('app.edit_shop'))
@section('page-heading', $shop->title)

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">

	<form action="{{ route('backend.shop.update', $shop->id) }}" method="POST" enctype="multipart/form-data" id="user-form">

		@csrf
		<div class="box box-default">
			<div class="box-header with-border">
				<h3 class="box-title">@lang('app.edit_shop')</h3>
			</div>

			<div class="box-body">


				@include('backend.shops.partials.base', ['edit' => true])

			</div>

			<div class="box-footer">
				<button type="submit" class="btn btn-primary">
					@lang('app.edit_shop')
				</button>

				@permission('shops.hard_delete')
				<a href="{{ route('backend.shop.hard_delete', $shop->id) }}" class="btn btn-danger" data-method="DELETE" data-confirm-title="@lang('app.please_confirm')" data-confirm-text="@lang('app.are_you_sure_delete_shop')" data-confirm-delete="@lang('app.yes_delete_him')">
					@lang('app.hard_delete')
				</a>
				@endpermission

				@permission('shops.delete')
				<a href="{{ route('backend.shop.delete', $shop->id) }}" class="btn btn-danger" data-method="DELETE" data-confirm-title="@lang('app.please_confirm')" data-confirm-text="@lang('app.are_you_sure_delete_shop')" data-confirm-delete="@lang('app.yes_delete_him')">
					@lang('app.delete_shop')
				</a>
				@endpermission


			</div>
		</div>
	</form>

</section>

@stop